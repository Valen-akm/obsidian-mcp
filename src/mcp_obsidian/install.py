from __future__ import annotations

import argparse
import shutil
import sys
from importlib import resources
from pathlib import Path

PLUGIN_ID = "obsidian-mcp-bridge"


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="mcp-obsidian-install",
        description="Install the MCP Bridge plugin into an Obsidian vault.",
    )
    parser.add_argument(
        "vault",
        type=Path,
        help="Path to your Obsidian vault root (the directory that contains .obsidian/).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing plugin files if present.",
    )
    args = parser.parse_args()

    vault = args.vault.expanduser().resolve()
    if not (vault / ".obsidian").is_dir():
        sys.exit(f"error: not an Obsidian vault (no .obsidian/ under {vault})")

    target = vault / ".obsidian" / "plugins" / PLUGIN_ID
    if target.exists() and not args.force:
        sys.exit(
            f"error: {target} already exists. Pass --force to overwrite, or delete it first."
        )

    target.mkdir(parents=True, exist_ok=True)

    plugin_dist = resources.files("mcp_obsidian").joinpath("plugin_dist")
    copied: list[str] = []
    for item in plugin_dist.iterdir():
        name = item.name
        if name.startswith("_") or name == "__pycache__":
            continue
        dest = target / name
        with resources.as_file(item) as src_path:
            shutil.copy(src_path, dest)
        copied.append(name)

    if not copied:
        sys.exit("error: plugin_dist is empty; reinstall the package.")

    print(f"✓ Installed {len(copied)} files to {target}")
    for name in copied:
        print(f"    {name}")
    print()
    print("Next steps:")
    print("  1. Open Obsidian → Settings → Community plugins")
    print("  2. Make sure Restricted mode is OFF")
    print("  3. Click the refresh icon next to 'Installed plugins'")
    print("  4. Toggle 'MCP Bridge' ON")
    print("  5. You should see a notice: 'MCP bridge online: 127.0.0.1:27300'")
    print()
    print("Then start the MCP server with:")
    print("  uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git mcp-obsidian")


if __name__ == "__main__":
    main()
