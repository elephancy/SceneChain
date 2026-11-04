"""Check initial SceneChain route metadata through its web server."""
import sys
from html.parser import HTMLParser
from urllib.error import HTTPError
from urllib.request import urlopen


class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonical = []
        self.robots = []
        self.title = ''
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'title':
            self.in_title = True
        if tag == 'meta' and attrs.get('name') == 'robots':
            self.robots.append(attrs.get('content'))
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical.append(attrs.get('href'))

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


base = sys.argv[1].rstrip('/')
for path, title, canonical in [
    ('/', 'SceneChain — Graphical Password Research Prototype', '/'),
    ('/how-it-works', 'How SceneChain Works | Graphical Password Research', '/how-it-works'),
    ('/how-it-works/', 'How SceneChain Works | Graphical Password Research', '/how-it-works'),
    ('/sign-in', 'SceneChain | Practice and Research Workspace', None),
    ('/research/session', 'SceneChain | Practice and Research Workspace', None),
    ('/practice', 'SceneChain | Practice and Research Workspace', None),
]:
    with urlopen(base + path, timeout=10) as response:
        head = Head()
        head.feed(response.read().decode('utf-8'))
        assert head.title == title, (path, head.title)
        assert head.canonical == (['https://scenechain.elfeel.me' + canonical] if canonical else []), path
        assert head.robots == ['index,follow' if canonical else 'noindex,follow'], path
        assert response.headers.get('Content-Security-Policy'), path
for path in ['/__seo', '/__seo/how.html']:
    try:
        response = urlopen(base + path, timeout=10)
    except HTTPError as error:
        response = error
    with response:
        assert response.status == 404, path
print('SceneChain initial route metadata verified')
