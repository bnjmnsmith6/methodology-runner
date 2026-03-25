# Code Puppy CLI Analysis

## 🚨 **STOP AND ASK**

The `code-puppy` CLI has a **much simpler interface** than the Claude CLI we were expecting. Here's what's available:

---

## Current code-puppy CLI (v0.0.433)

```bash
usage: code-puppy [-h] [--version] [--interactive] [--prompt PROMPT]
                  [--agent AGENT] [--model MODEL]
                  [command ...]

options:
  -h, --help           show this help message and exit
  --version, -v        Show version and exit
  --interactive, -i    Run in interactive mode
  --prompt, -p PROMPT  Execute a single prompt and exit (no interactive mode)
  --agent, -a AGENT    Specify which agent to use (e.g., --agent code-puppy)
  --model, -m MODEL    Specify which model to use (e.g., --model gpt-5)
```

---

## What We Expected (Claude CLI-style flags)

Our `cli-runner.ts` was built expecting these flags:

| Flag | Purpose | Status |
|------|---------|--------|
| `-p` (print mode) | Headless/non-interactive | ✅ Available as `--prompt` |
| `--output-format json` | Structured JSON output | ❌ **NOT AVAILABLE** |
| `--json-schema <path>` | Enforce result schema | ❌ **NOT AVAILABLE** |
| `--permission-mode dontAsk` | Don't block on permissions | ❌ **NOT AVAILABLE** |
| `--tools <list>` | Available tools | ❌ **NOT AVAILABLE** |
| `--allowedTools <list>` | Permission whitelist | ❌ **NOT AVAILABLE** |
| `--max-turns <n>` | Limit conversation length | ❌ **NOT AVAILABLE** |
| `--max-budget-usd <n>` | Cost cap | ❌ **NOT AVAILABLE** |
| `--append-system-prompt-file` | Custom system prompt | ❌ **NOT AVAILABLE** |
| `--session-id <id>` | Session continuation | ❌ **NOT AVAILABLE** |

---

## What code-puppy Actually Does

### Current Behavior
- Takes a `--prompt` string
- Runs interactively (shows thinking, responses)
- Outputs **rich console text** (not JSON)
- Has built-in tools: `cp_create_file`, `cp_read_file`, `cp_replace_in_file`, etc.
- Shows token usage as it runs
- Exits when done

### Example Output
```
Current version: 0.0.433
Executing prompt: Create a file called hello.txt with 'Hello World' in it

THINKING  ⚡ The user wants me to create a file...

AGENT RESPONSE
Alright, let's create that file for you! 🐶
  🔧 Calling cp_create_file...

CREATE FILE  ✨ CREATE hello.txt
+ Hello World

THINKING  ⚡ Great! The file was created successfully...

AGENT RESPONSE
Done! 🎉 Created hello.txt with "Hello World" inside. Easy peasy!
```

**This is NOT JSON.** It's rich terminal output meant for humans.

---

## Options to Proceed

### Option 1: Parse code-puppy's Text Output
**Approach:** Use code-puppy as-is, parse the terminal output

**Pros:**
- No changes needed to code-puppy
- Can use it immediately

**Cons:**
- Fragile parsing (terminal formatting, ANSI codes)
- No structured result contract
- Hard to extract changed files, test results, etc.
- No permission control or budget limits
- No session continuation

**Implementation:**
```typescript
// In cli-runner.ts
const args = [
  '--prompt', prompt
];

// Parse output for:
// - "✨ CREATE <filename>" → extract changed files
// - "Done!" → assume success
// - Error messages → assume failure
// - No reliable way to detect "needs_human"
```

---

### Option 2: Extend code-puppy with JSON Output
**Approach:** Contribute a `--json` flag to code-puppy

**Pros:**
- Clean, proper solution
- Benefits the whole community
- Can add all missing flags we need

**Cons:**
- Requires time to implement and PR
- Blocks current work
- May not be accepted upstream

**Implementation:**
Would require modifying code-puppy's Python source to:
1. Add `--json` flag
2. Suppress rich console output
3. Output structured JSON result
4. Add other flags as needed

---

### Option 3: Use code-puppy via Python API
**Approach:** Call code-puppy's Python API directly instead of CLI

**Pros:**
- Full control over input/output
- Can structure results as needed
- Can set permissions, budgets, etc.

**Cons:**
- Requires Python subprocess instead of CLI
- More complex integration
- Need to understand code-puppy's internal API

**Implementation:**
```python
# Custom Python script that imports code-puppy
from code_puppy import Agent, run_prompt
import json

result = await run_prompt(
    prompt=prompt,
    output_json=True,
    max_turns=50,
    # ... other config
)

print(json.dumps(result))
```

Then call this script from Node.js.

---

### Option 4: Fall Back to Mock Adapter
**Approach:** Keep code-puppy disabled until better integration is available

**Pros:**
- No risk, no complexity
- Can develop the rest of the system
- Can add real integration later

**Cons:**
- No real builds
- Can't test end-to-end workflow

**Implementation:**
```bash
# In .env
USE_REAL_CODEPUPPY=false
```

---

### Option 5: Check if `claude` CLI is Available
**Status:** ❌ `claude` CLI **not found** on system

The official Claude CLI (if it exists) might have the flags we need, but it's not installed.

---

## Recommendation

I recommend **Option 4** (fall back to mock) **temporarily** while we:

1. **Investigate** if there's a headless/JSON mode in code-puppy we haven't discovered
2. **Check** if there's a config file or environment variable that controls output
3. **Contact** code-puppy maintainers to ask about JSON output support
4. **Explore** the Python API approach as a backup

**Why?**
- Parsing terminal output is fragile and unreliable
- We need structured results for proper error handling
- Permission and budget controls are important safety features
- Session continuation is needed for debug cycles

---

## Questions for Ben

1. **Do you have access to a different build tool** with a more complete CLI?
   - Cursor CLI?
   - Aider CLI?
   - Something else?

2. **Is there a way to configure code-puppy** to output JSON?
   - Config file?
   - Environment variable?
   - Undocumented flag?

3. **Are you willing to use the Python API** approach instead of CLI?
   - Would require a Python wrapper script
   - More complex but more control

4. **Should we fall back to mock** for now and revisit later?
   - Allows us to continue other work
   - Can add real integration when ready

---

## Current Status

- ✅ Code Puppy adapter **fully implemented**
- ✅ TypeScript **compiles cleanly**
- ✅ Server **starts successfully**
- ✅ code-puppy **detected and initialized**
- ❌ CLI flags **not compatible**
- ⏸️  Real builds **blocked** until CLI issue resolved

---

**Next Action:** Awaiting Ben's decision on how to proceed.
