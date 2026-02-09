import kleur from "kleur";

const styles = {
  title: kleur.bold().blue,
  muted: kleur.dim,
  label: kleur.bold().blue,
  heading: kleur.bold,
};

type HelpRow = {
  value: string;
  description: string;
};

type UsageRow = {
  value: string;
  description: string;
  options?: HelpRow[];
};

type CommandHelp = {
  summary: string;
  usage: UsageRow[];
  notes?: string[];
};

type CommandHelpPrintOptions = {
  detailed?: boolean;
};

const commandHelp: Record<
  "open" | "new" | "rename" | "exit" | "remove" | "ls" | "which" | "run" | "tail" | "keys",
  CommandHelp
> = {
  open: {
    summary: "Open a tmux session",
    usage: [
      {
        value: "[session]",
        description: "Open by name. Omit to select a session interactively.",
      },
      {
        value: "<session> -p",
        description: "Open by name, or create it if missing.",
        options: [
          {
            value: "-p, --present",
            description: "If the session does not exist, create it and open it.",
          },
        ],
      },
    ],
  },
  new: {
    summary: "Create a new tmux session",
    usage: [
      {
        value: "new <session>",
        description: "Create and open a new session (default).",
        options: [
          {
            value: "-b, --background",
            description: "Create the session without attaching/switching to it.",
          },
        ],
      },
    ],
  },
  rename: {
    summary: "Rename tmux sessions",
    usage: [
      {
        value: "rename",
        description: "Select a session and rename it.",
      },
      {
        value: "rename <new>",
        description: "Rename the current session (inside tmux).",
      },
      {
        value: "rename <old> <new>",
        description: "Rename a specific session directly.",
      },
    ],
  },
  exit: {
    summary: "Exit the current tmux session",
    usage: [
      {
        value: "exit",
        description: "Prompt to detach or detach-and-remove.",
        options: [
          {
            value: "-d, --detach",
            description: "Detach and keep the session running.",
          },
          {
            value: "-k, --kill",
            description: "Kill the current session.",
          },
        ],
      },
    ],
  },
  remove: {
    summary: "Remove tmux sessions",
    usage: [
      {
        value: "remove",
        description: "Select one or more sessions and remove them.",
      },
      {
        value: "remove <name>",
        description: "Remove a specific session by name.",
      },
    ],
  },
  ls: {
    summary: "List tmux session names",
    usage: [
      {
        value: "ls",
        description: "Print tmux session names.",
      },
    ],
  },
  which: {
    summary: "Show current tmux session name",
    usage: [
      {
        value: "which",
        description: "Print the current tmux session name.",
      },
    ],
  },
  run: {
    summary: "Run a command inside a tmux session and return output",
    usage: [
      {
        value: "run <session> -- <cmd>",
        description: "Execute a command in the session's active pane and print output.",
      },
    ],
    notes: [
      "If you need shell operators, pass a single quoted command or use: sh -lc '<command>'.",
      "The command runs directly in the session shell and prints newly added terminal lines.",
      "If the command does not settle within 5 seconds, partial output is returned and run exits with code 124.",
    ],
  },
  tail: {
    summary: "Print recent scrollback from a tmux session",
    usage: [
      {
        value: "tail <session>",
        description: "Print the last 10 lines from the session's active pane.",
      },
      {
        value: "tail <session> -l <lines>",
        description: "Print the last <lines> lines.",
        options: [
          {
            value: "-l, --lines",
            description: "Number of lines to print (default: 10).",
          },
        ],
      },
    ],
  },
  keys: {
    summary: "Send keys directly to a tmux session",
    usage: [
      {
        value: "keys <session> <key>",
        description: "Pass key tokens directly to tmux send-keys.",
      },
      {
        value: "keys <session> -- <key>",
        description: "Use -- when key tokens could look like flags.",
      },
    ],
    notes: [
      "No Enter key is added automatically.",
      "Examples: tmm keys api C-c, tmm keys api Enter, tmm keys api -l \"npm run dev\".",
      "After sending keys, tmm prints newly added terminal lines and exits with code 124 on 5s timeout.",
    ],
  },
};

export type HelpTarget = keyof typeof commandHelp;
export type NamedCommand = Exclude<HelpTarget, "open">;

const namedCommands: readonly NamedCommand[] = [
  "new",
  "rename",
  "exit",
  "remove",
  "ls",
  "which",
  "run",
  "tail",
  "keys",
];

function printOptionRows(rows: HelpRow[], descriptionColumn: number): void {
  for (const row of rows) {
    const prefixIndent = 4;
    const prefixLen = prefixIndent + row.value.length;

    if (prefixLen >= descriptionColumn - 2) {
      console.log(`    ${styles.label(row.value)}`);
      console.log(
        `${" ".repeat(descriptionColumn)}${styles.muted(row.description)}`,
      );
      continue;
    }

    const padding = " ".repeat(
      Math.max(2, descriptionColumn - prefixLen),
    );
    console.log(
      `    ${styles.label(row.value)}${padding}${styles.muted(row.description)}`,
    );
  }
}

function formatCommandValue(value: string): string {
  return value
    .split(" ")
    .map((token) => {
      if (token.startsWith("<") || token.startsWith("[")) {
        return styles.muted(token);
      }
      return styles.label(token);
    })
    .join(" ");
}

function printCommandRows(rows: HelpRow[], pad = 32): void {
  for (const row of rows) {
    const padding = " ".repeat(Math.max(2, pad - row.value.length));
    console.log(`  ${formatCommandValue(row.value)}${padding}${row.description}`);
  }
}

export function isHelpFlag(value?: string): boolean {
  return value === "-h" || value === "--help";
}

export function isNamedCommand(value?: string): value is NamedCommand {
  return Boolean(value && namedCommands.includes(value as NamedCommand));
}

export function resolveHelpTarget(value: string): HelpTarget | null {
  if (value in commandHelp) return value as HelpTarget;
  if (value === "session" || value === "session-name") return "open";
  return null;
}

export function printMainHelp(): void {
  console.log(`${styles.title("tmm")} ${styles.muted("powerfully simple tmux session manager")}`);
  console.log("");
  console.log(styles.heading("Usage:"));
  printCommandRows([
    { value: "tmm", description: "Open a session interactively" },
    { value: "tmm <session>", description: "Open a session by name" },
    { value: "tmm <session> -p", description: "Open session or create if missing" },
  ]);
  console.log("");
  console.log(styles.heading("Commands:"));
  printCommandRows([
    { value: "new <name>", description: "Create a new session" },
    { value: "rename", description: "Select and rename a session" },
    { value: "remove [name]", description: "Remove sessions" },
    { value: "exit", description: "Exit current session (detach/remove)" },
  ]);
  console.log("");
  printCommandRows([
    { value: "tail <name> [--lines N]", description: "Show recent session output" },
    { value: "run <name> -- <cmd>", description: "Run command in session" },
    { value: "keys <name> <key>", description: "Send keys to session" },
  ]);
  console.log("");
  printCommandRows([
    { value: "ls", description: "List sessions" },
    { value: "which", description: "Show current session name" },
  ]);
  console.log("");
  printCommandRows([
    {
      value: "<command> --help",
      description: "Print help text for command",
    },
  ]);
}

export function printCommandHelp(
  target: HelpTarget,
  printOptions: CommandHelpPrintOptions = {},
): void {
  const detailed = printOptions.detailed ?? true;
  const doc = commandHelp[target];
  const showDefaultOnly = !detailed && doc.usage.length > 1;
  const usageRows = showDefaultOnly ? [doc.usage[0] ?? {
    value: target,
    description: doc.summary,
  }] : doc.usage;
  const noteRows = [...(doc.notes ?? [])];
  if (showDefaultOnly) {
    const commandName = target === "open" ? "session" : target;
    noteRows.push(`Run \`tmm ${commandName} --help\` to see additional usage forms.`);
  }
  const commandLabel =
    target === "open" ? "[session]" : (usageRows[0]?.value ?? target);

  console.log(
    `${styles.label("tmm")} ${formatCommandValue(commandLabel)} ${styles.muted("•")} ${styles.muted(doc.summary.toLowerCase())}`,
  );
  console.log("");

  console.log(styles.heading("Usage:"));
  const usageTextRows = usageRows.map((usageRow) => `tmm ${usageRow.value}`);
  const widestUsage = usageTextRows.reduce(
    (max, usage) => Math.max(max, usage.length),
    0,
  );
  const usageColumn = Math.min(Math.max(30, widestUsage + 2), 46);
  const descriptionColumn = usageColumn + 2;

  usageRows.forEach((usageRow, index) => {
    const usageText = usageTextRows[index] ?? `tmm ${usageRow.value}`;
    const usagePrefixLen = 2 + usageText.length;

    if (usagePrefixLen >= descriptionColumn - 2) {
      console.log(`  ${styles.label("tmm")} ${formatCommandValue(usageRow.value)}`);
      console.log(`${" ".repeat(descriptionColumn)}${usageRow.description}`);
    } else {
      const padding = " ".repeat(
        Math.max(2, descriptionColumn - usagePrefixLen),
      );
      console.log(
        `  ${styles.label("tmm")} ${formatCommandValue(usageRow.value)}${padding}${usageRow.description}`,
      );
    }

    const optionRows: HelpRow[] = [...(usageRow.options ?? [])];
    if (optionRows.length > 0) {
      printOptionRows(optionRows, descriptionColumn);
    }
  });

  if (noteRows.length > 0) {
    console.log("");
    console.log("Notes:");
    for (const note of noteRows) {
      console.log(`  ${note}`);
    }
  }
}
