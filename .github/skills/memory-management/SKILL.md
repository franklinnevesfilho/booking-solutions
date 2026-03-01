# Skill: Memory Management

This skill defines the rules for interacting with the `.agent-memory/` directory. It ensures that the project's long-term "brain" remains consistent, clean, and useful.

---

## 1. Directory Structure

- `.agent-memory/`
  - `project_decisions.md`: High-level architectural and design decisions.
  - `error_patterns.md`: Recurring bugs and their solutions.
  - `archive/`: Compressed or outdated entries.

---

## 2. Formatting Rules

### Markdown Precision

- Use clear headers for each entry.
- Include a "Context" section for decisions (Why was this made?).
- Include a "Pattern" and "Fix" section for error patterns.
- Date every entry in ISO format (YYYY-MM-DD).

### Atomic Updates

- Never overwrite the entire file unless performing Garbage Collection.
- Append new entries to the bottom or merge into existing relevant sections.
- Ensure no duplicate entries exist for the same problem/decision.

---

## 3. Conflict Resolution (Multi-Hive)

- In Multi-Hive mode, always work on the local branch copy.
- If a merge conflict occurs in memory files, prioritize the most descriptive and recent information.
- Use bullet points to list alternative approaches if consensus is not possible.

---

## 4. Smart Garbage Collection (Archiving)

- **Audit Trigger**: Perform a check when a memory file exceeds 500 lines.
- **Archiving Logic**:
  - Move the oldest 20% of entries to `.agent-memory/archive/`.
  - Name archive files as `[filename]-YYYY-MM-DD.md`.
  - Leave a "Tombstone" entry in the main file mentioning where the old data was moved.

---

---

## 6. Transaction Verification (Critical)

After every write or modification to `.agent-memory/`:

- **Read-Back**: You MUST read the file back to verify the entry was correctly appended/merged.
- **Consistency Check**: Ensure the new entry doesn't contradict existing high-priority decisions.
- **Success Report**: Explicitly state "Memory Transaction Successful: [Reason]" in your output. The Orchestrator relies on this to close the task.
