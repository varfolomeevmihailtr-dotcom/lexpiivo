#!/usr/bin/env python3
"""Notify private clan Telegram room of new public LastAsylum snapshot changes."""
import json
import os
from pathlib import Path
import requests

root = Path(__file__).resolve().parents[1]
live_file = root / 'LEX-PIIVO-site' / 'live.json'
state_file = root / 'scripts' / 'telegram-state.json'


def send(token, chat, text):
    res = requests.post('https://api.telegram.org/bot' + token + '/sendMessage',
                        json={'chat_id': chat, 'text': text, 'disable_web_page_preview': True},
                        timeout=25)
    res.raise_for_status()
    if not res.json().get('ok'):
        raise RuntimeError('Telegram rejected request')


def main():
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat = os.environ.get('TELEGRAM_CHAT_ID')
    if not token or not chat:
        print('Telegram not configured; no notifications sent.')
        return
    source = json.loads(live_file.read_text(encoding='utf-8'))
    previous = json.loads(state_file.read_text(encoding='utf-8')) if state_file.exists() else None
    codes = source.get('codes') or {}
    alliance = source.get('alliance') or {}
    if not codes.get('checked_at') or not alliance.get('checked_at'):
        print('No confirmed snapshot; skipping notifications.')
        return
    current = {
        'codes': codes.get('active') or [],
        'alliance_at': alliance.get('checked_at'),
        'code_at': codes.get('checked_at'),
        'event_at': os.environ.get('EVENTS_LAST_CHECK', ''),
    }
    if previous is None:
        state_file.write_text(json.dumps(current, indent=2) + '\n', encoding='utf-8')
        print('Telegram baseline saved without sending historical spam.')
        return
    notices = []
    if codes['checked_at'] != previous.get('code_at'):
        added = [c for c in current['codes'] if c not in previous.get('codes', [])]
        if added:
            notices.append('🎁 Новые промокоды Last Asylum (по LastAsylum.gg):\n' +
                           '\n'.join('• ' + v for v in added[:20]))
    if alliance['checked_at'] != previous.get('alliance_at'):
        joined = [e for e in source.get('last_changes', []) if e.get('type') == 'joined']
        left = [e for e in source.get('last_changes', []) if e.get('type') == 'left']
        if joined or left:
            lines = ['👥 Изменения [LEX] PIIVO · #347']
            lines += ['➕ ' + e['nickname'] for e in joined[:15]]
            lines += ['➖ ' + e['nickname'] for e in left[:15]]
            notices.append('\n'.join(lines))
    for notice in notices:
        send(token, chat, notice)
    state_file.write_text(json.dumps(current, indent=2) + '\n', encoding='utf-8')
    print('Telegram notices sent:', len(notices))


if __name__ == '__main__':
    main()
