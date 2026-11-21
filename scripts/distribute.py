"""Create a self-contained internal distribution from an Electron package."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import tarfile
import tempfile
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('platform', choices=['darwin', 'linux', 'win32'])
parser.add_argument('--split', action='store_true', help='Write parts for GitHub Releases')
args = parser.parse_args()
version = json.loads(Path('package.json').read_text())['version']
platform = args.platform
arch = 'arm64' if platform == 'darwin' else 'x64'
bundle = Path('release') / f'Invoicity-{platform}-{arch}'
out = Path('release') / 'downloads'
out.mkdir(parents=True, exist_ok=True)
name = {'darwin': f'Invoicity-{version}-macOS-arm64.tar.gz',
        'linux': f'invoicity_{version}_amd64.deb',
        'win32': f'Invoicity-{version}-Windows-x64.zip'}[platform]
target = out / name

def add_text(tar, name, content):
    data = content.encode()
    member = tarfile.TarInfo(name)
    member.size, member.mode = len(data), 0o644
    tar.addfile(member, io.BytesIO(data))

def install_metadata(member):
    member.uid = member.gid = 0
    member.uname = member.gname = 'root'
    if member.name.endswith('/chrome-sandbox'):
        member.mode = 0o4755
    return member

def ar_member(archive, file):
    size = file.stat().st_size
    header = f'{file.name + "/":<16}{0:<12}{0:<6}{0:<6}{"100644":<8}{size:<10}`\n'
    archive.write(header.encode('ascii'))
    with file.open('rb') as source:
        shutil.copyfileobj(source, archive, length=1024*1024)
    if size % 2:
        archive.write(b'\n')

if platform == 'darwin':
    with tarfile.open(target, 'w:gz', compresslevel=1) as tar:
        tar.add(bundle / 'Invoicity.app', 'Invoicity.app')
elif platform == 'win32':
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
        for file in sorted(bundle.rglob('*')):
            if file.is_file():
                archive.write(file, Path('Invoicity') / file.relative_to(bundle))
else:
    with tempfile.TemporaryDirectory(dir=out) as temp:
        stage = Path(temp)
        (stage/'debian-binary').write_bytes(b'2.0\n')
        with tarfile.open(stage/'control.tar.gz', 'w:gz') as tar:
            add_text(tar, './control', f'Package: invoicity\nVersion: {version}\nSection: utils\nPriority: optional\nArchitecture: amd64\nMaintainer: Invoicity\nDepends: libgtk-3-0t64 | libgtk-3-0, libnss3, libgbm1, libasound2t64 | libasound2, libgomp1, libcurl4t64 | libcurl4, libxss1, libxtst6, libxkbcommon0\nDescription: Private invoice spreadsheet assistant with offline AI models\n')
        with tarfile.open(stage/'data.tar.gz', 'w:gz', compresslevel=1) as tar:
            tar.add(bundle, './opt/invoicity', filter=install_metadata)
            add_text(tar, './usr/share/applications/invoicity.desktop', '[Desktop Entry]\nType=Application\nName=Invoicity\nExec=/opt/invoicity/Invoicity\nIcon=invoicity\nCategories=Office;Finance;\nTerminal=false\n')
            tar.add('scripts/invoicity.png', './usr/share/icons/hicolor/256x256/apps/invoicity.png', filter=install_metadata)
            link = tarfile.TarInfo('./usr/bin/invoicity')
            link.type, link.linkname, link.mode = tarfile.SYMTYPE, '/opt/invoicity/Invoicity', 0o777
            tar.addfile(link)
        with target.open('wb') as archive:
            archive.write(b'!<arch>\n')
            for member in ['debian-binary','control.tar.gz','data.tar.gz']:
                ar_member(archive,stage/member)

digest = hashlib.sha256()
with target.open('rb') as src:
    while chunk := src.read(4*1024*1024):
        digest.update(chunk)
(out / (name + '.sha256')).write_text(digest.hexdigest() + '  ' + name + '\n')
if args.split:
    with target.open('rb') as src:
        for i in range(1, (target.stat().st_size + 1799999999) // 1800000000 + 1):
            with (out / (name + '.part' + str(i))).open('wb') as part:
                remaining = 1800000000
                while remaining:
                    chunk = src.read(min(4*1024*1024, remaining))
                    if not chunk:
                        break
                    part.write(chunk)
                    remaining -= len(chunk)
print(target, digest.hexdigest())
