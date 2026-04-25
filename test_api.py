import urllib.request
import urllib.error
import json
import sys

req = urllib.request.Request(
    'https://rems-backend-5tev.onrender.com/api/auth/request-otp/',
    data=json.dumps({'email': 'admin@gmail.com'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

try:
    res = urllib.request.urlopen(req)
    print("SUCCESS")
    print(res.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    content = e.read().decode('utf-8')
    with open('error_page.html', 'w') as f:
        f.write(content)
    print(f"FAILED: {e.code}")
    # Print the first 1000 characters to stdout
    print(content[:1000])
