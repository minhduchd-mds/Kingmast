from __future__ import annotations

import json
from pathlib import Path
import sys
import unittest


def main() -> int:
    root = Path(__file__).resolve().parent
    suite = unittest.defaultTestLoader.discover(str(root), pattern='test_*.py')
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    summary = {
        'event': 'kingmast-camera-runtime-selftest',
        'testsRun': result.testsRun,
        'failures': len(result.failures),
        'errors': len(result.errors),
        'skipped': len(result.skipped),
        'allPassed': result.wasSuccessful(),
        'requiresCamera': False,
        'requiresModel': False,
        'physicalHardwareQualified': False,
        'controlAuthority': 'none',
    }
    print(json.dumps(summary, separators=(',', ':')))
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    sys.exit(main())
