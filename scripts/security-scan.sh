#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "          NaviMate AI — Security Scanner          "
echo "=================================================="

VIOLATIONS=0

scan_pattern() {
    local label="$1"
    local pattern="$2"

    # Search tracked/source files, excluding build artifacts, node_modules, git, scripts/security-scan.sh itself, and docs that mention scan patterns
    local matches
    matches=$(grep -r -n -E "$pattern" . \
        --exclude-dir={node_modules,dist,build,.gradle,.git,coverage} \
        --exclude={package-lock.json,bun.lock,security-scan.sh} \
        2>/dev/null || true)

    if [ -n "$matches" ]; then
        # Filter out benign documentation, local.properties.example or test placeholders
        local filtered
        filtered=$(echo "$matches" | grep -v -E "(local\.properties\.example|\.env\.example|AIzaSy_CI_BUILD_VALIDATION_MOCK|YOUR_|AIzaSy\.\.\.|docs/|shared/contracts\.ts)" || true)

        if [ -n "$filtered" ]; then
            echo "[FAIL] Potential committed credential found for $label:"
            # Print file and line numbers, but NEVER print the actual secret
            echo "$filtered" | awk -F: '{print "  -> File: " $1 ", Line: " $2}'
            VIOLATIONS=$((VIOLATIONS + 1))
        else
            echo "[PASS] $label check passed (no live secrets found)."
        fi
    else
        echo "[PASS] $label check passed (clean)."
    fi
}

echo "Scanning codebase for accidentally committed secrets..."
scan_pattern "Google API Key (AIza...)" "AIza[0-9A-Za-z_-]{35}"
scan_pattern "Hardcoded Gemini API Key assignment" "GEMINI_API_KEY\s*=\s*['\"][A-Za-z0-9_-]{10,}['\"]"
scan_pattern "Private Keys" "(BEGIN RSA PRIVATE KEY|BEGIN PRIVATE KEY)"
scan_pattern "Hardcoded Bearer Authorization" "Authorization:\s*Bearer\s+[A-Za-z0-9._-]{20,}"
scan_pattern "Hardcoded Live Route Token String" "routeToken\s*=\s*['\"](Cs|Co)[A-Za-z0-9_-]{30,}['\"]"

echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
    echo "=================================================="
    echo "[SECURITY SCAN FAILED] $VIOLATIONS credential rule violation(s) detected!"
    echo "=================================================="
    exit 1
else
    echo "=================================================="
    echo "[SECURITY SCAN PASSED] Zero live credentials or keys committed."
    echo "=================================================="
    exit 0
fi
