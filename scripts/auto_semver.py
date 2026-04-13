import json
import subprocess
import os
import re

VERSION_FILE = 'src/version.json'
PACKAGE_JSON = 'package.json'
ABOUT_JSX = 'src/pages/IEBCOffice/About.jsx'

def get_git_info():
    try:
        current_hash = subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode('utf-8').strip()
        # Get the short hash directly from git to avoid slicing issues
        current_hash_short = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD']).decode('utf-8').strip()
        return current_hash, current_hash_short
    except Exception as e:
        print(f"Error getting git info: {e}")
        return "", ""

def analyze_diff(last_hash, current_hash):
    try:
        diff_stat = subprocess.check_output(['git', 'diff', '--stat', last_hash, current_hash]).decode('utf-8')
        diff_summary = subprocess.check_output(['git', 'diff', '--shortstat', last_hash, current_hash]).decode('utf-8')
        
        # Grading Logic
        # Patch: Small tweaks
        # Minor: New files or significant additions
        # Major: Deletions of key files or massive refactors
        
        is_major = False
        is_minor = False
        
        # Check for new files (Minor)
        if ' create mode ' in subprocess.check_output(['git', 'diff', '--summary', last_hash, current_hash]).decode('utf-8'):
            is_minor = True
            
        # Check for major changes (Major)
        if ' delete mode ' in subprocess.check_output(['git', 'diff', '--summary', last_hash, current_hash]).decode('utf-8'):
            is_major = True
            
        # Check diff size
        match = re.search(r'(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?', diff_summary)
        if match:
            files_changed = int(match.group(1))
            insertions = int(match.group(2)) if match.group(2) else 0
            deletions = int(match.group(3)) if match.group(3) else 0
            
            if files_changed > 15 or (insertions + deletions) > 500:
                is_minor = True
            if files_changed > 40 or (insertions + deletions) > 1500:
                is_major = True
                
        if is_major: return 'major'
        if is_minor: return 'minor'
        return 'patch'
    except Exception as e:
        print(f"Error analyzing diff: {e}")
        return 'patch'

def bump_version(current_version, grade):
    major, minor, patch = map(int, current_version.split('.'))
    if grade == 'major':
        major += 1
        minor = 0
        patch = 0
    elif grade == 'minor':
        minor += 1
        patch = 0
    else:
        patch += 1
    return f"{major}.{minor}.{patch}"

def update_files(new_version, current_hash_short):
    # Update version.json
    with open(VERSION_FILE, 'w') as f:
        json.dump({"version": new_version, "last_commit": current_hash_short}, f, indent=2)
    
    # Update package.json
    if os.path.exists(PACKAGE_JSON):
        with open(PACKAGE_JSON, 'r') as f:
            pkg = json.load(f)
        pkg['version'] = new_version
        with open(PACKAGE_JSON, 'w') as f:
            json.dump(pkg, f, indent=2)
            
    # Update About.jsx (Hardcoded string replacement)
    if os.path.exists(ABOUT_JSX):
        with open(ABOUT_JSX, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace the NASAKA V... pattern
        new_content = re.sub(r'NASAKA V\d+\.\d+\.\d+', f'NASAKA V{new_version}', content)
        if new_content != content:
            with open(ABOUT_JSX, 'w', encoding='utf-8') as f:
                f.write(new_content)

def main():
    if not os.path.exists(VERSION_FILE):
        print(f"Version file {VERSION_FILE} not found.")
        return

    with open(VERSION_FILE, 'r') as f:
        state = json.load(f)
    
    last_hash = state.get('last_commit')
    current_hash, current_hash_short = get_git_info()
    
    if not current_hash or current_hash_short == last_hash:
        print("No new commits detected or git error.")
        return

    grade = analyze_diff(last_hash, current_hash)
    new_version = bump_version(state['version'], grade)
    
    print(f"Bumping version: {state['version']} -> {new_version} ({grade})")
    update_files(new_version, current_hash_short)

if __name__ == "__main__":
    main()
