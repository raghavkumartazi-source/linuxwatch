import importlib.util
from pathlib import Path
import types
import unittest
spec = importlib.util.spec_from_file_location('agent', Path(__file__).resolve().parents[1] / 'agent.py')
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)
class AgentTests(unittest.TestCase):
    def test_cpu_ignores_guest_double_count_and_measures_delta(self):
        self.assertEqual(agent.cpu_snapshot('cpu 10 0 10 80 0 0 0 0 20 0'), (100, 80))
        self.assertEqual(agent.cpu_percent((100, 80), (200, 120)), 60)
        self.assertEqual(agent.cpu_percent((100, 80), (100, 80)), 0)
    def test_memory_and_disk_percent(self):
        self.assertEqual(agent.memory_percent('MemTotal: 1000 kB\nMemAvailable: 250 kB\n'), 75)
        self.assertEqual(agent.disk_percent(types.SimpleNamespace(f_blocks=1000, f_bavail=200)), 80)
    def test_rejects_insecure_or_credential_bearing_servers(self):
        for endpoint in ['http://example.test', 'https://user:secret@example.test', 'https://example.test?token=x', 'file:///tmp/test', 'https://example.test/path']:
            with self.assertRaises(ValueError): agent.validate_endpoint(endpoint)
        self.assertEqual(agent.validate_endpoint('https://example.test/'), 'https://example.test/api/metrics')
        self.assertEqual(agent.validate_endpoint('http://127.0.0.1:3000'), 'http://127.0.0.1:3000/api/metrics')
if __name__ == '__main__': unittest.main()
