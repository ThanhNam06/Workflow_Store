#!/usr/bin/env python3
"""
WorkflowManager.py - Minimal admin uploader for WorkflowStore
- Uploads a workflow archive via multipart/form-data to backend /api/admin/workflows
- Sends x-admin-key header for authentication
- Usage: python3 WorkflowManager.py --file ./myworkflow.zip --title "My Workflow" --price 5.00

Notes:
- Requires requests (pip install requests)
- Keeps simple CLI and optional interactive mode
"""
import argparse
import os
import sys
import requests

API_URL = os.environ.get('WORKFLOWSTORE_API', 'http://localhost:3001')
ADMIN_KEY = os.environ.get('WORKFLOWSTORE_ADMIN_KEY', '')


def upload(file_path, title=None, price=None, price_usd=None, category=None, description=None, admin_key=None):
    admin_key = admin_key or ADMIN_KEY
    if not admin_key:
        print('ERROR: ADMIN key not set. Provide via --admin-key or WORKFLOWSTORE_ADMIN_KEY env var')
        return 2
    if not os.path.exists(file_path):
        print('ERROR: file not found:', file_path)
        return 2

    url = f"{API_URL}/api/admin/workflows"
    headers = {'x-admin-key': admin_key}
    data = {
        'title': title or os.path.basename(file_path),
        'price': price or '',
        'price_usd': price_usd or '',
        'category': category or 'uncategorized',
        'description': description or ''
    }
    files = {'file': (os.path.basename(file_path), open(file_path, 'rb'), 'application/zip')}

    print('Uploading to', url)
    r = requests.post(url, headers=headers, data=data, files=files)
    try:
        resp = r.json()
    except Exception:
        resp = r.text
    print('Status:', r.status_code)
    print('Response:', resp)
    return 0 if r.status_code == 200 else 1


if __name__ == '__main__':
    p = argparse.ArgumentParser(description='WorkflowManager: upload workflow files to WorkflowStore backend')
    p.add_argument('--file', '-f', required=True, help='Path to workflow file (zip)')
    p.add_argument('--title', help='Workflow title')
    p.add_argument('--price', help='Price (display)')
    p.add_argument('--price-usd', help='Price in USD')
    p.add_argument('--category', help='Category')
    p.add_argument('--description', help='Description')
    p.add_argument('--admin-key', help='Admin API key (overrides env var)')
    args = p.parse_args()

    sys.exit(upload(args.file, title=args.title, price=args.price, price_usd=args.price_usd, category=args.category, description=args.description, admin_key=args.admin_key))
