import re
with open('error_page.txt', 'rb') as f:
    text = f.read().decode('utf-8', errors='ignore')

# The Django 500 debug page has <title>ExceptionType at /path</title>
title_match = re.search(r'<title>(.*?)</title>', text, re.IGNORECASE | re.DOTALL)
if title_match:
    print("TITLE:", title_match.group(1).strip().replace('\n', ' '))

# Exception value is often in <div class="exception_value">
exc_match = re.search(r'<div class="exception_value">(.*?)</div>', text, re.IGNORECASE | re.DOTALL)
if exc_match:
    print("EXCEPTION VALUE:", exc_match.group(1).strip().replace('\n', ' '))
else:
    # Look for the first <th>Exception Value:</th><td>...</td>
    exc_match = re.search(r'<th>Exception Value:</th>\s*<td><pre>(.*?)</pre></td>', text, re.IGNORECASE | re.DOTALL)
    if exc_match:
        print("EXCEPTION VALUE:", exc_match.group(1).strip().replace('\n', ' '))
