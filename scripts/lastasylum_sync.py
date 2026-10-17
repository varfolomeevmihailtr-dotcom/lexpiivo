#!/usr/bin/env python3
"""Public LastAsylum.gg snapshot for [LEX]PIIVO (#347). No game login or robots bypass."""
from __future__ import annotations

import datetime as dt
import json
import os
from pathlib import Path
import re
import sys
import time
import unicodedata
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

HOME = 'https://lastasylum.gg'
SERVER = HOME + '/en/leaderboard/servers/347/alliance-power'
CODES = HOME + '/en/codes'
USER_AGENT = 'LEXPIIVO-clan-dashboard/1.0 (+https://github.com/varfolomeevmihailtr-dotcom/lexpiivo)'
PATH = Path(__file__).resolve().parents[1] / 'LEX-PIIVO-site' / 'live.json'
SESSION = requests.Session()
SESSION.headers.update({'User-Agent': USER_AGENT, 'Accept': 'text/html'})
_ROBOTS = {}


def now_utc():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def clean(value):
    return ' '.join(str(value or '').replace('\u200b', '').replace('\u200d', '').split())


def number(value):
    stripped = re.sub(r'[^\d]', '', str(value or ''))
    return int(stripped) if stripped and len(stripped) <= 18 else None


def allowed(url):
    origin = '{0.scheme}://{0.netloc}'.format(urlparse(url))
    if origin not in _ROBOTS:
        try:
            response = SESSION.get(origin + '/robots.txt', timeout=18)
            if response.status_code == 404:
                _ROBOTS[origin] = None
            elif response.status_code != 200:
                raise RuntimeError('robots.txt HTTP ' + str(response.status_code))
            else:
                r = RobotFileParser()
                r.parse(response.text.splitlines())
                _ROBOTS[origin] = r
        except Exception as exc:
            raise RuntimeError('Cannot verify robots policy: ' + str(exc)) from exc
    policy = _ROBOTS[origin]
    return policy is None or policy.can_fetch(USER_AGENT, url)


def fetch(url):
    if not url.startswith(HOME + '/'):
        raise RuntimeError('Unexpected source host: ' + url)
    if not allowed(url):
        raise RuntimeError('Blocked by robots policy: ' + url)
    response = SESSION.get(url, timeout=35)
    response.raise_for_status()
    if len(response.content) > 6_000_000:
        raise RuntimeError('Response unexpectedly large')
    return response.text


def parse_codes(html):
    doc = BeautifulSoup(html, 'html.parser')
    main = doc.select_one('main') or doc
    texts = [clean(v) for v in main.stripped_strings]
    start = next((i for i, s in enumerate(texts) if s.lower().startswith(('working codes', 'active codes', 'действующие коды', 'рабочие коды'))), None)
    end = next((i for i, s in enumerate(texts) if s.lower().startswith(('expired codes', 'истекшие коды', 'просроченные коды'))), None)
    if start is None:
        raise ValueError('Working codes heading not found')
    if end is not None and end <= start:
        end = None

    def collect(parts):
        result = []
        for part in parts:
            for candidate in re.split(r'[\s,;]+', part):
                candidate = candidate.strip('.,():[]' + chr(96) + chr(34) + chr(39))
                if re.fullmatch(r'(?i)(?:LA[A-Z0-9_-]{3,22}|twlap\d{3,5})', candidate) or re.fullmatch(r'[A-Z0-9]{6,22}', candidate):
                    if candidate not in result:
                        result.append(candidate)
        return result

    all_after_start = collect(texts[start + 1:])
    if end is not None:
        active = collect(texts[start + 1:end])
        expired = collect(texts[end + 1:])
    else:
        summary = ' '.join(texts[:start])
        count_match = re.search(r'(\d+)\s+working\s+Last\s+Asylum\s+gift\s+codes', summary, re.I)
        expected = int(count_match.group(1)) if count_match else None
        if expected is None or expected < 1 or expected > 100 or len(all_after_start) < expected:
            raise ValueError('Cannot distinguish working from expired codes; no reliable count')
        active = all_after_start[:expected]
        expired = all_after_start[expected:]
    summary = ' '.join(texts[:start])
    expected_match = re.search(r'(\d+)\s+working\s+Last\s+Asylum\s+gift\s+codes', summary, re.I)
    if expected_match and len(active) != int(expected_match.group(1)):
        raise ValueError('Incomplete active codes: expected '+expected_match.group(1)+', found '+str(len(active)))
    active_lower = {s.lower() for s in active}
    expired = [s for s in expired if s.lower() not in active_lower]
    if not 1 <= len(active) <= 100:
        raise ValueError('Unexpected active code count: ' + str(len(active)))
    return {'checked_at': now_utc(), 'source': CODES,
            'active': active, 'expired': expired}


def canonical_url(path):
    u = urljoin(HOME, path)
    parts = urlparse(u)
    if parts.netloc != 'lastasylum.gg':
        return None
    if not re.fullmatch(r'/(?:en|ru)/leaderboard/alliance/\d+', parts.path):
        return None
    return parts.scheme + '://' + parts.netloc + parts.path


def is_lex_piivo(text):
    normalized = unicodedata.normalize('NFKC', text or '').casefold().replace(' ', '')
    return bool(re.search(r'\[lex\].*piivo', normalized))


def find_alliance_url(server_html):
    doc = BeautifulSoup(server_html, 'html.parser')
    matches = []
    for a in doc.select('a[href*="/leaderboard/alliance/"]'):
        row = a.find_parent('tr') or a.parent
        text = clean(row.get_text(' ', strip=True))
        if is_lex_piivo(text):
            url = canonical_url(a.get('href', ''))
            if url:
                matches.append(url)
    matches = sorted(set(matches))
    if len(matches) != 1:
        raise ValueError('Cannot uniquely locate [LEX]PIIVO on #347: ' + str(len(matches)) + ' match(es)')
    return matches[0]



def parse_server_alliances(html):
    doc = BeautifulSoup(html, 'html.parser')
    result = []
    for table in doc.select('table'):
        header = [clean(h.get_text(' ', strip=True)).lower() for h in table.select('thead th')]
        power_idx = next((i for i, h in enumerate(header) if h.startswith('power') or h.startswith('мощ')), None)
        rows = []
        for tr in table.select('tr'):
            a = tr.select_one('a[href*="/leaderboard/alliance/"]')
            if not a:
                continue
            href = canonical_url(a.get('href', ''))
            cells = tr.select('td')
            if not href or not cells:
                continue
            name = clean((a.find_parent('td') or a).get_text(' ', strip=True))
            place = number(cells[0].get_text(' ', strip=True))
            power = number(cells[power_idx].get_text(' ', strip=True)) if power_idx is not None and len(cells)>power_idx else None
            rows.append({'rank': place, 'name': name, 'power': str(power) if power is not None else None, 'url': href})
        if len(rows) > len(result):
            result = rows
    return result

def parse_members(doc):
    for table in doc.select('table'):
        headers = [clean(x.get_text(' ', strip=True)).casefold()
                   for x in table.select('thead th')]
        if not headers:
            first = table.select_one('tr')
            headers = [clean(x.get_text(' ', strip=True)).casefold()
                       for x in first.select('th')] if first else []
        if not (any('player' in h or 'игрок' in h for h in headers) and
                any('power' in h or 'мощ' in h for h in headers) and
                any('rank' in h or 'ранг' in h for h in headers)):
            continue
        def col(*terms):
            return next((i for i, h in enumerate(headers)
                         if any(h.startswith(term) for term in terms)), None)
        player, ranking, power = col('player', 'игрок'), col('rank', 'ранг'), col('power', 'мощ')
        if player is None or power is None:
            continue
        players = []
        for row in (table.select_one('tbody') or table).select('tr'):
            cells = row.select('td')
            if len(cells) <= max(player, power):
                continue
            nick = clean(cells[player].get_text(' ', strip=True))
            might = number(cells[power].get_text(' ', strip=True))
            if not nick or might is None:
                continue
            role = clean(cells[ranking].get_text(' ', strip=True)).upper() if (
                ranking is not None and len(cells) > ranking) else ''
            if role not in {'R1', 'R2', 'R3', 'R4', 'R5'}:
                role = None
            link = cells[player].select_one('a[href]')
            matched_id = re.search(r'/player/(\d+)', link.get('href', '')) if link else None
            players.append({'nickname': nick, 'power': might, 'rank': role,
                            'game_player_id': matched_id.group(1) if matched_id else None})
        if players:
            return players
    raise ValueError('No recognizable alliance member table')


def parse_alliance(html, url):
    doc = BeautifulSoup(html, 'html.parser')
    headline = doc.select_one('h1')
    title = clean(headline.get_text(' ', strip=True)) if headline else ''
    if not is_lex_piivo(title):
        raise ValueError('Alliance name differs from [LEX]PIIVO: ' + title[:90])
    members = parse_members(doc)
    if len(members) > 150:
        raise ValueError('More than 150 members, likely wrong page')
    return {'checked_at': now_utc(), 'source': url, 'server': 347,
            'name': title, 'member_count': len(members),
            'roster_power_sum': str(sum(m['power'] for m in members)),
            'members': members,
            'note': 'Displayed member power sum; not necessarily official alliance Might.'}


def main():
    previous = {}
    if PATH.exists():
        try:
            previous = json.loads(PATH.read_text(encoding='utf-8'))
        except (ValueError, OSError):
            previous = {}
    result = {key: value for key, value in previous.items()
              if key in ('codes', 'alliance')}
    result['attempted_at'] = now_utc()
    result['sources'] = {'codes': CODES, 'server': SERVER}
    errors = {}
    diagnostics = {}
    try:
        codes_html = fetch(CODES)
        result['codes'] = parse_codes(codes_html)
        print('Codes:', len(result['codes']['active']), 'working')
    except Exception as exc:
        errors['codes'] = str(exc)
        if 'codes_html' in locals():
            doc = BeautifulSoup(codes_html, 'html.parser')
            diagnostics['codes_title'] = clean(doc.title.get_text())[:120] if doc.title else ''
            diagnostics['codes_headings'] = [clean(h.get_text())[:80] for h in doc.select('h1,h2,h3')][:30]
            diagnostics['codes_excerpt'] = [clean(x)[:60] for x in list((doc.select_one('main') or doc).stripped_strings)[:30]]
        print('Code update failed:', exc, file=sys.stderr)
    try:
        html = fetch(SERVER)
        direct = os.environ.get('LEX_ALLIANCE_URL', '') or (
            previous.get('alliance') or {}).get('source', '')
        url = canonical_url(direct) if direct else None
        if not url:
            url = find_alliance_url(html)
        board = parse_server_alliances(html)
        time.sleep(1)
        result['alliance'] = parse_alliance(fetch(url), url)
        result['alliance']['top_server_alliances'] = board[:10]
        for row in board:
            if row['url'] == url:
                result['alliance']['server_rank'] = row['rank']
                result['alliance']['official_power'] = row['power']
                break
        print('Alliance:', url, '| members:', result['alliance']['member_count'])
    except Exception as exc:
        errors['alliance'] = str(exc)
        if 'html' in locals():
            doc = BeautifulSoup(html, 'html.parser')
            diagnostics['server_title'] = clean(doc.title.get_text())[:120] if doc.title else ''
            diagnostics['server_headings'] = [clean(h.get_text())[:80] for h in doc.select('h1,h2,h3')][:20]
            urls = [x.get('href','') for x in doc.select('a[href*="/leaderboard/alliance/"]')]
            diagnostics['alliance_link_count'] = len(urls)
            diagnostics['alliance_link_examples'] = urls[:5]
            diagnostics['mentions_piivo'] = 'piivo' in html.lower()
            tab = doc.find(string=re.compile(r'Alliances by power', re.I))
            diagnostics['alliance_tab_html'] = str(tab.parent)[:700] if tab and tab.parent else 'not found'
            diagnostics['server_links_first'] = [a.get('href','') for a in doc.select('main a[href]')][:25]
            diagnostics['server_excerpt'] = [clean(x)[:60] for x in list((doc.select_one('main') or doc).stripped_strings)[:30]]
        print('Alliance update failed:', exc, file=sys.stderr)
    result['errors'] = errors
    result['diagnostics'] = diagnostics
    PATH.parent.mkdir(parents=True, exist_ok=True)
    PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Snapshot saved; previous good sections retained on errors.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
