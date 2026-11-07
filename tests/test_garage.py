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

    def test_the_tank_is_never_over_full_and_a_quiet_week_is_empty(self):
        self.assertEqual(pulse.fuel_level([{'week': 500}], goal=60)['level'], 1.0)
        self.assertEqual(pulse.fuel_level([], goal=60)['level'], 0.0)

    def test_a_bad_goal_falls_back(self):
        self.assertEqual(pulse.fuel_level([{'week': 30}], goal='lots')['goal'], 60)
        self.assertEqual(pulse.fuel_level([{'week': 30}], goal=0)['goal'], 1)


class GarageConfTests(unittest.TestCase):
    def test_defaults_and_overrides(self):
        c = pulse.garage_conf({'cpu': 70, 'cluster': 'compact', 'motion': 'reduced', 'mechanics': False})
        self.assertEqual((c['cpu'], c['cluster'], c['motion'], c['mechanics']), (70.0, 'compact', 'reduced', False))
        self.assertEqual(c['ram'], pulse.GARAGE_DEFAULTS['ram'])

    def test_nonsense_is_ignored(self):
        c = pulse.garage_conf({'cpu': 'hot', 'cluster': 'huge', 'unknown': 1})
        self.assertEqual(c['cpu'], pulse.GARAGE_DEFAULTS['cpu'])
        self.assertEqual(c['cluster'], 'full')
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


class StateTests(unittest.TestCase):
    def test_state_carries_fuel_and_garage_settings(self):
        hub = pulse.Hub()
        hub.fuel = pulse.fuel_level([{'week': 6}], 60)
        st = hub.state()
        self.assertEqual(st['fuel']['commits'], 6)
        self.assertEqual(st['ui']['garage']['cluster'], 'full')

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
        js = (WEB / 'garage.js').read_text()
        for word in ('vram', 'token', 'cost', 'Math.random'):
            self.assertNotIn(word, js.lower() if word != 'Math.random' else js, word)


if __name__ == '__main__':
    unittest.main()
