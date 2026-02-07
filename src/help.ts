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

type CommandHelp = {
  summary: string;
  usage: string[];
  arguments?: HelpRow[];
  options?: HelpRow[];
  notes?: string[];
};

type CommandHelpPrintOptions = {
  detailed?: boolean;
};

const commandHelp: Record<
  "open" | "new" | "rename" | "exit" | "remove" | "ls" | "which",
  CommandHelp
> = {
  open: {
    summary: "Open a tmux session",
    usage: ["[session-name]"],
    arguments: [
      {
        value: "[session-name]",
        description: "Existing session to open. Omit to select interactively.",
      },
    ],
  },
  new: {
    summary: "Create and open a new tmux session",
    usage: ["new <session-name>"],
    arguments: [
      {
        value: "<session-name>",
        description: "Session name to create and open.",
      },
    ],
  },
  rename: {
    summary: "Rename tmux sessions",
    usage: [
      "rename",
      "rename <new-session-name>",
      "rename <old-session-name> <new-session-name>",
    ],
    arguments: [
      {
        value: "<new-session-name>",
        description: "Rename the current session (inside tmux).",
      },
      {
        value: "<old-session-name> <new-session-name>",
        description: "Rename a specific session directly.",
      },
    ],
  },
  exit: {
    summary: "Exit the current tmux session",
    usage: ["exit [options]"],
    options: [
      {
        value: "-d, --detach",
        description: "Detach from the current session and keep it running.",
      },
      {
        value: "-k, --kill",
        description: "Kill the current session.",
      },
    ],
    notes: ["Without options, prompts to detach or detach-and-remove."],
  },
  remove: {
    summary: "Remove tmux sessions",
    usage: ["remove [session-name]"],
    arguments: [
      {
        value: "[session-name]",
        description: "Session to remove. Omit to choose multiple interactively.",
      },
    ],
  },
  ls: {
    summary: "List tmux session names",
    usage: ["ls"],
  },
  which: {
    summary: "Show current tmux session name",
    usage: ["which"],
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
];

function printRows(rows: HelpRow[], pad = 32): void {
  for (const row of rows) {
    const padding = " ".repeat(Math.max(2, pad - row.value.length));
    console.log(`  ${styles.label(row.value)}${padding}${row.description}`);
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
  console.log(`${styles.title("tmm")} ${styles.muted("tmux session manager")}`);
  console.log("");
  console.log(styles.heading("Usage:"));
  console.log(
    `  ${styles.label("tmm")} <command> ${styles.muted("[...flags] [...args]")}`,
  );
  console.log("");
  console.log(styles.heading("Commands:"));
  printCommandRows([
    {
      value: "[session-name]",
      description: "Open a session (interactively or by name)",
    },
    { value: "new <name>", description: "Create and open a new session" },
    { value: "rename", description: "Select and rename a session" },
    { value: "remove [name]", description: "Remove sessions" },
    { value: "exit", description: "Exit current session (detach/remove)" },
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
  console.log(`${styles.title("tmm")} ${styles.muted(doc.summary)}`);
  console.log("");

  const usageLines =
    !detailed && target === "rename" ? [doc.usage[0] ?? "rename"] : doc.usage;
  const argumentRows =
    !detailed && target === "rename" ? [] : (doc.arguments ?? []);
  const noteRows =
    !detailed && target === "rename"
      ? ["Run `tmm rename --help` to see additional usage forms."]
      : (doc.notes ?? []);

  console.log(styles.heading("Usage:"));
  for (const usageLine of usageLines) {
    console.log(`  ${styles.label("tmm")} ${formatCommandValue(usageLine)}`);
  }

  if (argumentRows.length > 0) {
    console.log("");
    console.log("Arguments:");
    printRows(argumentRows);
  }

  const optionRows: HelpRow[] = [...(doc.options ?? []), {
    value: "-h, --help",
    description: "Show help for this command.",
  }];

  console.log("");
  console.log("Options:");
  printRows(optionRows);

  if (noteRows.length > 0) {
    console.log("");
    console.log("Notes:");
    for (const note of noteRows) {
      console.log(`  ${note}`);
    }
  }
}
