# Invoicity

Invoicity is a free, local AI finance assistant for spreadsheets. Give it a transaction report, ask for a weekly revenue breakdown, and inspect the numbers and formulas in an editable workbook. The desktop app includes the models for chat, vision, and dictation, so your finance team can work offline.

[Download Invoicity](https://invoicity.org/) · [GitHub Releases](https://github.com/m9ter1a/invoicity/releases)

## Install the desktop app

| Platform | How to install |
| --- | --- |
| macOS on Apple Silicon | Extract the `.tar.gz` archive and open `Invoicity.app`. The app has an ad hoc signature. |
| Windows x64 | Extract the entire ZIP archive, then open `Invoicity.exe` inside the extracted folder. |
| Ubuntu 24.04 x64 | In the download directory, run `sudo apt install ./invoicity_0.1.11_amd64.deb`, then open Invoicity from the applications menu. Adjust the filename for other versions. |

The finance model uses Metal on Apple Silicon and runs on the CPU on Windows and Linux. The team selected it for machines with 16 GB of memory. The 0.1 builds are intended for internal testing.

## Try a revenue report

1. Choose **Get started**, then **New spreadsheet**. To work with an existing workbook, choose **Import a file**. The optional first-run tour shows where to create, import, search, and bookmark workbooks.
2. Attach a small PDF that lists transaction dates, regions, and amounts. In **Invoicity Agent**, type “Build a table of weekly revenue by region from this PDF. Add a total for each week.”
3. Check the resulting cells and expand the change details under the reply. Select a total and ask “Which transactions make up this number?” To try a simple edit in a blank workbook, ask “Write 42 into D2.”
4. Choose **Export** to save the report. CSV and TSV export the active sheet. The other export formats include the whole workbook.

To dictate a request, click the microphone in the chat. Local speech recognition adds the words to your draft. After two seconds of silence following speech, the app sends the request. Click the recording indicator before then to stop and edit the draft yourself.

## Workbooks and attachments

The Univer editor supports multiple sheets, formulas, range selection, clipboard paste, row and column resizing, sorting, filters, formatting, merged cells, undo, and redo. The workspace keeps a searchable history and bookmarks. It starts in light mode and remembers your theme preference.

| Operation | Supported formats |
| --- | --- |
| Import a spreadsheet | XLSX, XLS, XLSB, ODS, CSV, TSV |
| Export a workbook | XLSX, XLS, ODS, DOCX, PDF |
| Export the active sheet | CSV, TSV |
| Attach to a chat | Up to two text files, spreadsheets, Word documents (DOCX), PDFs, or images per request |

The agent can write values and formulas, change sheet structure, format ranges, sort, and filter. It checks the sheet state before applying edits. Choose **Review this invoice** to check for formula errors, inconsistent line-item totals, missing invoice details, and duplicate invoice numbers for a supplier. Macros, pivot tables, and charts are outside the scope of 0.1, and complex workbooks may look different after export.

The app extracts embedded PDF text directly. For scanned documents and images, it uses Apple Vision on macOS and local Tesseract OCR with English and Russian language data on Windows and Linux. It reads up to the first 30 PDF pages and marks partial extracts. Each request can include up to 9,200 characters of cell data and 6,000 characters per attachment. Select the relevant cells when asking about a large workbook.

## Privacy and chat memory

Workbooks and chat histories are saved in the `books` folder inside Electron’s per-user `userData` directory. Invoicity writes files atomically and requests owner-only file permissions. The files contain plain text, so protection at rest depends on the user account and disk settings.

When you send a message, the app captures the visible spreadsheet area. SmolVLM describes it locally. Nemotron receives that description, a map of fill colors for up to 32 × 32 visible cells, workbook data, and the current selection. The model server listens on `127.0.0.1` and uses a random session key. The app blocks external network requests from the interface, loads the model on first use, and stops it when the app closes.

Each workbook has its own chat. Under **Chat context**, you can compress the conversation into a Nemotron summary or clear it entirely. Both actions require confirmation. Subsequent requests use the summary and recent messages within an 8,200-character history budget. To remove a workbook and its chat, click the trash icon in the workspace and confirm. Invoicity moves the local copy to the system trash and preserves the file you originally imported.

## Bundled models

- **Finance assistant:** Tere Labs’ Invoicity quantization of NVIDIA Nemotron 3 Nano 4B. The importance matrix was calibrated on the app’s finance prompts, workbooks, and JSON action plans. Mamba output and attention projection tensors use Q8_0, with the standard Q4_K_M mix for the remaining tensors. [Tere Labs model](https://huggingface.co/terelabs/Nemotron-3-Nano-4B-Invoicity-GGUF) · [NVIDIA base model](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-4B-BF16)
- **Spreadsheet vision:** SmolVLM-500M-Instruct describes the editor screenshot. Its weights and vision projector together occupy about 520 MiB. [Vision model](https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF)
- **Voice input:** Multilingual Whisper Base transcribes microphone input locally through whisper.cpp.

On 200 held-out prompts, the Tere Labs quantization matched the BF16 model’s action plan in 85% of cases. The standard Q4_K_M quantization without an importance matrix matched it in 72.5%. The Tere Labs file was 316 MB larger and had the same measured CPU speed in that evaluation. NVIDIA lists English as the supported language. The app also accepts Russian prompts, with results varying by task.

The finance model revision and SHA-256 checksum are pinned in the [model manifest](src/finance-model.json). The packager verifies the bundled file against that checksum. Each distribution includes the NVIDIA Nemotron Open Model License.

## Build from source

Install Node.js 24 or later, npm, curl, tar, CMake, and a C++ toolchain. On macOS, install the Apple Command Line Tools as well. The preparation step downloads the pinned runtimes and model weights and builds the local speech engine. Run these commands from the repository root on your target platform:

```sh
npm ci
node scripts/prepare-target.mjs
npm test
npm start
```

To package and test the desktop app after preparation:

```sh
npm run package
node tests/platform.mjs
```

On headless Linux, run the platform check with `xvfb-run -a node tests/platform.mjs`. To produce a downloadable archive or Debian package, run `python3 scripts/distribute.py TARGET` with `darwin`, `win32`, or `linux`. The output and its SHA-256 checksum are written to `release/downloads/`.

For cross-packaging on a Mac, first run `node scripts/prepare-voice.mjs` on the target OS and copy the resulting `vendor/voice-TARGET` directory to the build machine. Pass the same target to both `node scripts/prepare-target.mjs TARGET` and `npm run package -- TARGET`.

### Reassemble a split GitHub release

The website serves a single download. If you use GitHub Releases instead, download every numbered part for your platform and its matching `.sha256` file into the same directory. Replace `NAME` below with the full archive or package filename and list all parts in numeric order.

| Platform | Join the parts (three-part example) | Verify the result |
| --- | --- | --- |
| macOS | `cat NAME.part1 NAME.part2 NAME.part3 > NAME` | `shasum -a 256 -c NAME.sha256` |
| Linux | `cat NAME.part1 NAME.part2 NAME.part3 > NAME` | `sha256sum -c NAME.sha256` |
| Windows (Command Prompt) | `copy /b NAME.part1+NAME.part2+NAME.part3 NAME` | Run `certutil -hashfile NAME SHA256` and compare its output with `NAME.sha256`. |

Once the checksum matches, follow the installation instructions for your platform above.
