import os
import sys
import unittest

THIS_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.abspath(os.path.join(THIS_DIR, '..', 'src'))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from xiaoy_contracts.decoder import decode_tick


class TestDecoder(unittest.TestCase):
    def test_decode_ok(self):
        t = decode_tick({"ts_ms": 1, "symbol": "ESZ5", "price": 100.5, "volume": 10})
        self.assertEqual(t["symbol"], "ESZ5")
        self.assertEqual(t["ts_ms"], 1)
        self.assertEqual(t["price"], 100.5)
        self.assertEqual(t["volume"], 10)

    def test_unknown_fields_count(self):
        count = {"n": 0}

        def on_unknown(name, value):
            count["n"] += 1

        t = decode_tick({"ts_ms": 2, "symbol": "ESZ5", "price": 1.0, "extra": 42}, on_unknown)
        self.assertEqual(t["symbol"], "ESZ5")
        self.assertGreaterEqual(count["n"], 1)

    def test_missing_required_raises(self):
        with self.assertRaises(Exception):
            decode_tick({"symbol": "ESZ5"})


if __name__ == '__main__':
    unittest.main()

