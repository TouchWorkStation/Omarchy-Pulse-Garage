import importlib.machinery
import importlib.util
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

path = Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_garage', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)
WEB = Path(__file__).resolve().parents[1] / 'extras/pulse/web'


class FuelTests(unittest.TestCase):
    def test_points_are_commits_pushes_and_branches(self):
        f = pulse.fuel_level([{'week': 10, 'pushed': 8, 'branches': 2, 'today': 3},
                              {'week': 5, 'pushed': 0, 'branches': 1, 'today': 0}], goal=60)
        self.assertEqual(f['points'], 10 + 5 + 8 + 3 * 3)
        self.assertAlmostEqual(f['level'], 32 / 60, places=3)
        self.assertEqual((f['commits'], f['pushed'], f['branches'], f['today'], f['repos']), (15, 8, 3, 3, 2))

    def test_the_strip_totals_come_from_every_repository(self):
        f = pulse.fuel_level([{'week': 1, 'total': 1000, 'tags': 4}, {'week': 0, 'total': 82, 'tags': 1}], goal=60)
        self.assertEqual((f['allCommits'], f['releases'], f['repos']), (1082, 5, 1))

    def test_the_tank_is_never_over_full_and_a_quiet_week_is_empty(self):
        self.assertEqual(pulse.fuel_level([{'week': 500}], goal=60)['level'], 1.0)
        self.assertEqual(pulse.fuel_level([], goal=60)['level'], 0.0)

    def test_a_bad_goal_falls_back(self):
        self.assertEqual(pulse.fuel_level([{'week': 30}], goal='lots')['goal'], 60)
        self.assertEqual(pulse.fuel_level([{'week': 30}], goal=0)['goal'], 1)


class GitHubFuelTests(unittest.TestCase):
    NOW = 1_800_000_000.0

    def ev(self, kind, ago_h, **payload):
        import datetime as dt
        t = dt.datetime.fromtimestamp(self.NOW - ago_h * 3600, dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        return {'type': kind, 'created_at': t, 'repo': {'name': 'you/garage'}, 'payload': payload}

    def test_the_week_on_github(self):
        events = [self.ev('PushEvent', 1, size=3, distinct_size=2), self.ev('PushEvent', 30, size=4),
                  self.ev('PushEvent', 24 * 9, size=50),                         # older than a week: gone
                  self.ev('CreateEvent', 5, ref_type='branch'), self.ev('CreateEvent', 5, ref_type='tag'),
                  self.ev('PullRequestEvent', 2, action='closed', pull_request={'merged': True}),
                  self.ev('PullRequestEvent', 2, action='closed', pull_request={'merged': False}),
                  self.ev('ReleaseEvent', 3, action='published'), self.ev('WatchEvent', 1)]
        a = pulse.github_activity(events, 'you', now=self.NOW)
        self.assertEqual((a['pushes'], a['commits'], a['branches'], a['merged'], a['releases']), (2, 6, 1, 1, 1))
        self.assertEqual(a['last_repo'], 'garage')
        self.assertEqual(a['repos'], ['you/garage'])

    def test_a_push_without_commit_details_still_counts_one(self):
        a = pulse.github_activity([self.ev('PushEvent', 1)], 'you', now=self.NOW)
        self.assertEqual((a['pushes'], a['commits']), (1, 1))

    def test_linked_fuel_never_counts_a_commit_twice(self):
        gh = {'login': 'you', 'pushes': 4, 'commits': 10, 'branches': 1, 'merged': 2, 'releases': 1, 'today': 3}
        f = pulse.fuel_level([{'week': 7, 'pushed': 7, 'branches': 2, 'today': 1}], 100, gh)
        self.assertEqual(f['source'], 'github')
        self.assertEqual(f['commits'], 10)                      # the larger of local and GitHub
        self.assertEqual(f['branches'], 2)
        self.assertEqual(f['points'], 10 + 2 * 4 + 3 * 2 + 5 * 2 + 10 * 1)
        self.assertEqual(pulse.fuel_level([{'week': 7}], 100)['source'], 'git')

    def test_the_fuel_panel_opens_the_github_profile(self):
        hub = pulse.Hub()
        hub.gh_activity = {'login': 'TouchWorkStation'}
        with mock.patch.object(pulse.shutil, 'which', return_value='/usr/bin/xdg-open'), \
                mock.patch.object(pulse.subprocess, 'Popen') as po:
            self.assertTrue(hub.click('garage-fuel'))
        self.assertEqual(po.call_args[0][0], ['xdg-open', 'https://github.com/TouchWorkStation'])
        hub.gh_activity = {'login': 'bad; rm -rf ~'}
        with mock.patch.object(pulse.shutil, 'which', return_value='/usr/bin/xdg-open'), \
                mock.patch.object(pulse.subprocess, 'Popen') as po:
            self.assertFalse(hub.click('garage-fuel'))
        po.assert_not_called()


class GarageConfTests(unittest.TestCase):
    def test_defaults_and_overrides(self):
        c = pulse.garage_conf({'cpu': 70, 'colors': 'theme', 'motion': 'reduced', 'plate': '~/car.jpg', 'dash': False})
        self.assertEqual((c['cpu'], c['colors'], c['motion'], c['plate'], c['dash']), (70.0, 'theme', 'reduced', '~/car.jpg', False))
        self.assertEqual(c['ram'], pulse.GARAGE_DEFAULTS['ram'])

    def test_nonsense_is_ignored(self):
        c = pulse.garage_conf({'cpu': 'hot', 'colors': 'rainbow', 'unknown': 1})
        self.assertEqual(c['cpu'], pulse.GARAGE_DEFAULTS['cpu'])
        self.assertEqual(c['colors'], 'garage')
        self.assertNotIn('unknown', c)


class SceneSwitchTests(unittest.TestCase):
    def test_with_scene_keeps_the_rest_of_the_file(self):
        text = '# mine\n[pulse]\ncity = "Destin"\nscene = "sphere"   # comment\n\n[git]\nmax = 8\n'
        out = pulse.with_scene(text, 'garage')
        self.assertIn('scene = "garage"', out)
        self.assertIn('city = "Destin"', out)
        self.assertIn('[git]\nmax = 8', out)
        self.assertEqual(out.count('scene ='), 1)

    def test_with_scene_adds_it_when_missing(self):
        self.assertIn('[pulse]\nscene = "garage"', pulse.with_scene('[pulse]\ncity = ""\n', 'garage'))
        self.assertTrue(pulse.with_scene('', 'calm').startswith('[pulse]\nscene = "calm"'))

    def test_scene_command_writes_the_config_and_back(self):
        with tempfile.TemporaryDirectory() as d:
            conf = Path(d) / 'pulse.toml'
            conf.write_text('[pulse]\nscene = "sphere"\n')
            with mock.patch.object(pulse, 'CONF', conf), mock.patch.object(pulse, 'CONF_DIR', Path(d)), \
                    mock.patch.object(pulse, 'quiet_client', return_value=0), mock.patch('builtins.print'):
                self.assertEqual(pulse.main(['omarchy-pulse', 'scene', 'garage']), 0)
                self.assertIn('scene = "garage"', conf.read_text())
                self.assertEqual(pulse.main(['omarchy-pulse', 'scene', 'sphere']), 0)
                self.assertIn('scene = "sphere"', conf.read_text())
                self.assertEqual(pulse.main(['omarchy-pulse', 'scene', 'disco']), 1)
                self.assertIn('scene = "sphere"', conf.read_text())


class GitActivityTests(unittest.TestCase):
    def test_git_info_counts_today_and_branches(self):
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ, GIT_AUTHOR_NAME='t', GIT_AUTHOR_EMAIL='t@t', GIT_COMMITTER_NAME='t',
                       GIT_COMMITTER_EMAIL='t@t')
            run = lambda *a: subprocess.run(['git', '-C', d, *a], check=True, capture_output=True, env=env)
            run('init', '-q', '-b', 'main')
            run('commit', '-q', '--allow-empty', '-m', 'one')
            run('commit', '-q', '--allow-empty', '-m', 'two')
            run('branch', 'feature')
            info = pulse.git_info(d)
        self.assertEqual(info['week'], 2)
        self.assertEqual(info['today'], 2)
        self.assertEqual(info['branches'], 2)
        self.assertEqual(info['pushed'], 0)   # no remote: nothing pushed
        self.assertEqual((info['total'], info['tags']), (2, 0))


class StateTests(unittest.TestCase):
    def test_state_carries_fuel_and_garage_settings(self):
        hub = pulse.Hub()
        hub.fuel = pulse.fuel_level([{'week': 6}], 60)
        st = hub.state()
        self.assertEqual(st['fuel']['commits'], 6)
        self.assertEqual(st['ui']['garage']['colors'], 'garage')

    def test_the_garage_brings_its_colours_unless_told_otherwise(self):
        hub = pulse.Hub()
        hub.scene_override = 'garage'
        self.assertEqual(hub.colors()['preset'], 'garage')
        self.assertEqual(hub.colors()['colors']['accent'], '#ff2a3e')
        with mock.patch.object(hub, 'conf', side_effect=lambda *k, default=None: {'garage': {'colors': 'theme'}}.get(k[0], default) if len(k) == 1 else default):
            self.assertEqual(hub.colors()['preset'], 'theme')
        hub.scene_override = 'sphere'
        self.assertEqual(hub.colors()['preset'], 'theme')

    def test_the_garage_adds_its_panels_to_pulse(self):
        js = (WEB / 'pulse.js').read_text()
        self.assertIn('PulseGarage.panels(S, left, right, panel, bodyOf)', js)

    def test_agents_remember_when_they_changed_state(self):
        hub = pulse.Hub()
        with mock.patch.object(pulse.time, 'time', return_value=1000.0):
            hub.set_agent('claude · site', 'working', 'editing')
        with mock.patch.object(pulse.time, 'time', return_value=1300.0):
            hub.set_agent('claude · site', 'waiting', 'needs you')
        a = hub.agents['claude · site']
        self.assertEqual((a['since'], a['changed']), (1000.0, 1300.0))


class PageTests(unittest.TestCase):
    def test_the_page_loads_the_garage_before_pulse(self):
        html = (WEB / 'index.html').read_text()
        self.assertLess(html.index('garage.js'), html.index('pulse.js'))

    def test_the_garage_invents_nothing_it_cannot_read(self):
        js = (WEB / 'garage.js').read_text().lower()
        for word in ('stars', 'cost', 'tokens used', 'mechanic'):
            self.assertNotIn(word, js, word)

    def test_the_page_loads_the_garage_styles(self):
        self.assertIn('garage.css', (WEB / 'index.html').read_text())


class PlateTests(unittest.TestCase):
    def test_only_an_image_can_be_a_plate(self):
        with tempfile.TemporaryDirectory() as d:
            secret = Path(d) / 'id_rsa'
            secret.write_text('no')
            with mock.patch.object(pulse, 'WEB', Path(d) / 'web'):
                self.assertIsNone(pulse.garage_plate({'plate': str(secret)}))
                pic = Path(d) / 'car.jpg'
                pic.write_bytes(b'\xff\xd8')
                self.assertEqual(pulse.garage_plate({'plate': str(pic)}), pic)

    def test_a_picture_in_the_config_folder_is_found_without_config(self):
        with tempfile.TemporaryDirectory() as d:
            pic = Path(d) / 'garage.png'
            pic.write_bytes(b'x')
            with mock.patch.object(pulse, 'CONF_DIR', Path(d)), mock.patch.object(pulse, 'WEB', Path(d) / 'web'):
                self.assertEqual(pulse.garage_plate({}), pic)

    def test_anchors_sit_beside_the_plate(self):
        with tempfile.TemporaryDirectory() as d:
            pic = Path(d) / 'car.png'
            pic.write_bytes(b'x')
            (Path(d) / 'car.json').write_text('{"headlights": [[0.2, 0.6, 30]]}')
            self.assertEqual(pulse.plate_anchors(pic)['headlights'][0][0], 0.2)
            self.assertEqual(pulse.plate_anchors(None), {})

    def test_the_plate_route_needs_the_token(self):
        import threading, urllib.request, urllib.error
        from http.server import ThreadingHTTPServer
        hub = pulse.Hub()
        srv = ThreadingHTTPServer(('127.0.0.1', 0), pulse.make_handler(hub, 'tok', 0))
        port = srv.server_address[1]
        h = pulse.make_handler(hub, 'tok', port)
        srv.RequestHandlerClass = h
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            with self.assertRaises(urllib.error.HTTPError) as e:
                urllib.request.urlopen(f'http://127.0.0.1:{port}/api/garage/anchors')
            self.assertEqual(e.exception.code, 401)
            r = urllib.request.urlopen(f'http://127.0.0.1:{port}/api/garage/anchors?token=tok')
            self.assertEqual(r.status, 200)
        finally:
            srv.shutdown()


class VramTests(unittest.TestCase):
    def test_nvidia_vram(self):
        out = subprocess.CompletedProcess([], 0, stdout='2048, 8192\n')
        with mock.patch.object(pulse.Path, 'glob', return_value=[]), mock.patch.object(pulse.shutil, 'which', return_value='/x'), \
                mock.patch.object(pulse.subprocess, 'run', return_value=out):
            self.assertEqual(pulse.read_vram(), 25.0)

    def test_no_gpu_no_number(self):
        with mock.patch.object(pulse.Path, 'glob', return_value=[]), mock.patch.object(pulse.shutil, 'which', return_value=None):
            self.assertIsNone(pulse.read_vram())


if __name__ == '__main__':
    unittest.main()
