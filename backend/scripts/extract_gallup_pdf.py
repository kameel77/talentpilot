"""CLI helper for extracting Gallup talent rankings from a PDF report."""

from __future__ import annotations

import argparse
import sys

from services.gallup_pdf_parser import dump_rankings_json, extract_gallup_rankings


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Extract Gallup rankings from a PDF report.")
    parser.add_argument("pdf_path", help="Path to the Gallup PDF report")
    parser.add_argument("--output", "-o", help="Optional path to save JSON output")
    return parser


def main(pdf_path: str | None = None, output: str | None = None) -> None:
    parser = build_parser()

    if pdf_path is not None:
        args = argparse.Namespace(pdf_path=pdf_path, output=output)
    else:
        clean_argv: list[str] = []
        args_to_check = sys.argv[1:]
        i = 0
        while i < len(args_to_check):
            arg = args_to_check[i]
            if arg == "-f":
                i += 2
            else:
                clean_argv.append(arg)
                i += 1

        try:
            args = parser.parse_args(clean_argv)
        except SystemExit as exc:
            if exc.code == 2:
                print(
                    "Error parsing arguments. Provide 'pdf_path' or call main(pdf_path='your.pdf')."
                )
                return
            raise

    rankings, page_index = extract_gallup_rankings(args.pdf_path)
    payload = dump_rankings_json(rankings)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(payload)

    if page_index is None:
        print("No results page detected.")
    else:
        print(f"Results page index: {page_index}")
    print(payload)


if __name__ == "__main__":
    main()
