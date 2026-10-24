"""Extract symbols, imports, and calls from Python, TypeScript, and shell source files."""

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence


class ExtractError(RuntimeError):
    """Raised when parsing fails due to missing grammar or unsupported file."""
    pass


SUPPORTED_SUFFIXES: tuple[str, ...] = (".py", ".ts", ".tsx", ".sh")


def normalize_id(s: str) -> str:
    """Normalize a string to a valid identifier: NFKC, replace non-word chars with _, collapse _, strip _, casefold."""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[^\w]+", "_", s, flags=re.UNICODE)
    s = re.sub(r"_+", "_", s)
    return s.strip("_").casefold()


def file_id(rel_path: str) -> str:
    """Generate an ID for a file path."""
    return normalize_id(rel_path)


def symbol_id(rel_path: str, name: str) -> str:
    """Generate an ID for a symbol (class/function/type) in a file."""
    return f"{normalize_id(rel_path)}__{normalize_id(name)}"


def language_for(rel_path: str) -> str | None:
    """Determine the language based on file suffix."""
    suffix = Path(rel_path).suffix.lower()
    if suffix == ".py":
        return "python"
    elif suffix == ".ts":
        return "typescript"
    elif suffix == ".tsx":
        return "tsx"
    elif suffix == ".sh":
        return "shell"
    return None


@dataclass(frozen=True)
class Symbol:
    """A module-level symbol definition."""
    name: str
    kind: str  # 'class', 'function', or 'type'
    line: int  # 1-based


@dataclass(frozen=True)
class RawImport:
    """An unresolved import as written in source."""
    module: str
    line: int  # 1-based


@dataclass(frozen=True)
class RawCall:
    """A function call."""
    callee: str
    caller: str | None  # name of enclosing symbol, or None for file scope
    line: int  # 1-based
    # How the callee was written. None for a bare `helper()`. For `x.helper()`
    # it is the trailing identifier of the receiver chain ('x'), or '' when the
    # receiver is not a name at all — `Path(p).resolve()`. The builder needs the
    # distinction: only a module-qualified receiver can name a symbol in
    # another file, so '' and `self` must not resolve across files.
    receiver: str | None = None


@dataclass(frozen=True)
class FileFacts:
    """Everything one file contributes to the graph."""
    rel_path: str
    language: str
    symbols: tuple[Symbol, ...]
    imports: tuple[RawImport, ...]
    calls: tuple[RawCall, ...]


_parser_cache: dict[str, object] = {}


def parser_for(language: str):
    """Get a configured tree-sitter Parser for the given language."""
    if language in _parser_cache:
        return _parser_cache[language]

    from tree_sitter import Language, Parser

    if language == "python":
        import tree_sitter_python
        parser = Parser(Language(tree_sitter_python.language()))
    elif language == "typescript":
        import tree_sitter_typescript
        parser = Parser(Language(tree_sitter_typescript.language_typescript()))
    elif language == "tsx":
        import tree_sitter_typescript
        parser = Parser(Language(tree_sitter_typescript.language_tsx()))
    elif language == "shell":
        import tree_sitter_bash
        parser = Parser(Language(tree_sitter_bash.language()))
    else:
        raise ExtractError(f"tree-sitter grammar unavailable for {language}")

    _parser_cache[language] = parser
    return parser


def parse_source(rel_path: str, source: str) -> FileFacts:
    """Parse source text and extract symbols, imports, and calls."""
    lang = language_for(rel_path)
    if lang is None:
        raise ExtractError(f"unsupported file: {rel_path}")

    parser = parser_for(lang)
    source_bytes = source.encode("utf-8")
    tree = parser.parse(source_bytes)

    symbols = []
    imports = []
    calls = []

    # tree-sitter reports byte offsets, so slicing must happen on the same bytes
    # the parser saw — slicing the str drifts on every non-ASCII character.
    if lang == "python":
        _extract_python(tree, rel_path, source_bytes, symbols, imports, calls)
    elif lang == "shell":
        _extract_shell(tree, rel_path, source_bytes, symbols, imports, calls)
    else:  # typescript or tsx
        _extract_typescript(tree, rel_path, source_bytes, symbols, imports, calls)

    return FileFacts(
        rel_path,
        lang,
        tuple(symbols),
        tuple(imports),
        tuple(calls)
    )


def parse_file(root: Path, rel_path: str) -> FileFacts:
    """Read and parse a file, handling all exceptions gracefully."""
    try:
        source = (root / rel_path).read_text(encoding="utf-8", errors="replace")
        return parse_source(rel_path, source)
    except Exception:
        lang = language_for(rel_path) or ""
        return FileFacts(rel_path, lang, (), (), ())


def _receiver_name(node, get_text) -> str:
    """Trailing identifier of a receiver chain, or '' when the receiver is not a name.

    `rank.rank_files()` gives 'rank', `mg_graph.rank.rank_files()` also gives
    'rank' (the module the symbol would live in), and `Path(p).resolve()` gives
    '' because the receiver is a call result, not a module.
    """
    if node is None:
        return ""
    if node.type in ("identifier", "property_identifier"):
        return get_text(node)
    if node.type == "attribute":
        return _receiver_name(node.child_by_field_name("attribute"), get_text)
    if node.type == "member_expression":
        return _receiver_name(node.child_by_field_name("property"), get_text)
    return ""


def _extract_python(tree, rel_path: str, source: bytes, symbols: list, imports: list, calls: list):
    """Extract symbols, imports, and calls from Python source."""
    root = tree.root_node

    # Track module-level symbols by name for call resolution
    symbol_names = {}

    def get_text(node) -> str:
        """Get the text of a node from source."""
        return source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")

    def get_name(node) -> str | None:
        """Get the name field of a node."""
        name_node = node.child_by_field_name("name")
        if name_node and name_node.type == "identifier":
            return get_text(name_node)
        return None

    # First pass: collect module-level symbols
    for child in root.children:
        if child.type == "class_definition":
            name = get_name(child)
            if name:
                line = child.start_point[0] + 1
                symbols.append(Symbol(name, "class", line))
                symbol_names[name] = True
        elif child.type == "function_definition":
            name = get_name(child)
            if name:
                line = child.start_point[0] + 1
                symbols.append(Symbol(name, "function", line))
                symbol_names[name] = True
        elif child.type == "decorated_definition":
            # Check if the decorated node is a class or function
            for subchild in child.children:
                if subchild.type == "class_definition":
                    name = get_name(subchild)
                    if name:
                        line = subchild.start_point[0] + 1
                        symbols.append(Symbol(name, "class", line))
                        symbol_names[name] = True
                    break
                elif subchild.type == "function_definition":
                    name = get_name(subchild)
                    if name:
                        line = subchild.start_point[0] + 1
                        symbols.append(Symbol(name, "function", line))
                        symbol_names[name] = True
                    break

    # Second pass: collect imports and calls
    def visit_node(node, current_symbol: str | None = None):
        """Recursively visit nodes to find imports and calls."""
        if node.type == "import_statement":
            for child in node.children:
                if child.type == "dotted_name":
                    module = get_text(child)
                    line = node.start_point[0] + 1
                    imports.append(RawImport(module, line))
                elif child.type == "aliased_import":
                    # Find the dotted_name within
                    for subchild in child.children:
                        if subchild.type == "dotted_name":
                            module = get_text(subchild)
                            line = node.start_point[0] + 1
                            imports.append(RawImport(module, line))
                            break

        elif node.type == "import_from_statement":
            module_name_node = node.child_by_field_name("module_name")
            if module_name_node:
                module_name = get_text(module_name_node)
                line = node.start_point[0] + 1
                imports.append(RawImport(module_name, line))

        elif node.type == "call":
            func_node = node.child_by_field_name("function")

            if func_node:
                callee = None
                receiver = None
                if func_node.type == "identifier":
                    callee = get_text(func_node)
                elif func_node.type == "attribute":
                    # Get the attribute field
                    attr_node = func_node.child_by_field_name("attribute")
                    if attr_node and attr_node.type == "identifier":
                        callee = get_text(attr_node)
                        receiver = _receiver_name(
                            func_node.child_by_field_name("object"), get_text
                        )

                if callee:
                    line = node.start_point[0] + 1
                    calls.append(RawCall(callee, current_symbol, line, receiver))

        # Recurse for nested scopes
        for child in node.children:
            visit_node(child, current_symbol)

    # Visit from root's children to collect imports/calls
    for child in root.children:
        if child.type == "class_definition":
            name = get_name(child)
            symbol_name = name if name else None
            for subchild in child.children:
                visit_node(subchild, symbol_name)
        elif child.type == "function_definition":
            name = get_name(child)
            symbol_name = name if name else None
            for subchild in child.children:
                visit_node(subchild, symbol_name)
        elif child.type == "decorated_definition":
            # Check decorated definition's actual target
            symbol_name = None
            for subchild in child.children:
                if subchild.type in ("class_definition", "function_definition"):
                    name = get_name(subchild)
                    symbol_name = name
                    for subsubchild in subchild.children:
                        visit_node(subsubchild, symbol_name)
                    break
        else:
            visit_node(child, None)


_SHELL_QUOTES: frozenset[str] = frozenset({'"', "'"})


def _shell_literal(node, get_text) -> str:
    """The literal text of a shell word, with every expansion removed.

    Shell paths are half variable: `"$REPO_ROOT/engine/compress-memory.py"`.
    tree-sitter keeps the two apart — expansions are their own nodes and the
    literal is `string_content` — so dropping the expansions leaves
    `/engine/compress-memory.py`, which is enough to match a real file by
    suffix. A word made entirely of expansions yields '' and resolves to
    nothing, which is the honest answer.
    """
    if node.type in ("word", "string_content"):
        return get_text(node)
    if node.type == "raw_string":
        return get_text(node)[1:-1]
    if node.type in ("string", "concatenation", "command_name"):
        return "".join(
            _shell_literal(child, get_text)
            for child in node.children
            if get_text(child) not in _SHELL_QUOTES
        )
    return ""


def _extract_shell(tree, rel_path: str, source: bytes, symbols: list, imports: list, calls: list):
    """Extract functions, file references, and function calls from shell source.

    Shell has no import statement, so a file reference is any word that reads as
    a path to another source file — `source lib.sh`, `python3 "$E/build.py"`.
    That is what an import edge means here: this script depends on that file.
    """
    root = tree.root_node

    def get_text(node) -> str:
        return source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")

    def visit_node(node, current_symbol: str | None = None):
        if node.type == "function_definition":
            name_node = node.child_by_field_name("name")
            name = get_text(name_node) if name_node is not None else None
            if name:
                symbols.append(Symbol(name, "function", node.start_point[0] + 1))
                current_symbol = name

        elif node.type == "command":
            name_node = node.child_by_field_name("name")
            if name_node is not None:
                callee = _shell_literal(name_node, get_text)
                # `./build.sh` is a file reference, not a call to a function
                # this repo defines; the path branch below picks it up.
                if callee and "/" not in callee:
                    calls.append(
                        RawCall(callee, current_symbol, node.start_point[0] + 1)
                    )

        if node.type in ("word", "string", "concatenation", "raw_string"):
            literal = _shell_literal(node, get_text)
            # A message that ends in a filename is not a file reference:
            # `echo "session-end.sh must invoke compress-memory.py"`. Paths in
            # this codebase never contain whitespace, so requiring that is
            # enough to keep prose out of the graph.
            if literal.endswith(SUPPORTED_SUFFIXES) and not any(
                ch.isspace() for ch in literal
            ):
                imports.append(RawImport(literal, node.start_point[0] + 1))
            return  # a word has no sub-words worth revisiting

        for child in node.children:
            visit_node(child, current_symbol)

    visit_node(root, None)


def _extract_typescript(tree, rel_path: str, source: bytes, symbols: list, imports: list, calls: list):
    """Extract symbols, imports, and calls from TypeScript/TSX source."""
    root = tree.root_node

    def get_text(node) -> str:
        """Get the text of a node from source."""
        return source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")

    def get_name(node) -> str | None:
        """Get the name identifier from a declaration."""
        name_node = node.child_by_field_name("name")
        if name_node and name_node.type in ("identifier", "type_identifier"):
            return get_text(name_node)
        return None

    # First pass: collect top-level symbols
    for child in root.children:
        if child.type == "class_declaration":
            name = get_name(child)
            if name:
                line = child.start_point[0] + 1
                symbols.append(Symbol(name, "class", line))
        elif child.type == "function_declaration":
            name = get_name(child)
            if name:
                line = child.start_point[0] + 1
                symbols.append(Symbol(name, "function", line))
        elif child.type in ("interface_declaration", "type_alias_declaration"):
            name = get_name(child)
            if name:
                line = child.start_point[0] + 1
                symbols.append(Symbol(name, "type", line))
        elif child.type == "export_statement":
            # Check what's being exported
            for subchild in child.children:
                if subchild.type == "class_declaration":
                    name = get_name(subchild)
                    if name:
                        line = subchild.start_point[0] + 1
                        symbols.append(Symbol(name, "class", line))
                elif subchild.type == "function_declaration":
                    name = get_name(subchild)
                    if name:
                        line = subchild.start_point[0] + 1
                        symbols.append(Symbol(name, "function", line))
                elif subchild.type in ("interface_declaration", "type_alias_declaration"):
                    name = get_name(subchild)
                    if name:
                        line = subchild.start_point[0] + 1
                        symbols.append(Symbol(name, "type", line))
                elif subchild.type == "lexical_declaration":
                    # Check for arrow functions and regular functions
                    for var in subchild.children:
                        if var.type == "variable_declarator":
                            var_name = None
                            var_value = None
                            for decl_child in var.children:
                                if decl_child.field_name == "name" and decl_child.type == "identifier":
                                    var_name = get_text(decl_child)
                                elif decl_child.field_name == "value":
                                    var_value = decl_child

                            if var_name and var_value and var_value.type in ("arrow_function", "function"):
                                line = subchild.start_point[0] + 1
                                symbols.append(Symbol(var_name, "function", line))
        elif child.type == "lexical_declaration":
            # Check for arrow function variable declarations at top level
            for var in child.children:
                if var.type == "variable_declarator":
                    var_name = None
                    var_value = None
                    for decl_child in var.children:
                        if decl_child.field_name == "name" and decl_child.type == "identifier":
                            var_name = get_text(decl_child)
                        elif decl_child.field_name == "value":
                            var_value = decl_child

                    if var_name and var_value and var_value.type in ("arrow_function", "function"):
                        line = child.start_point[0] + 1
                        symbols.append(Symbol(var_name, "function", line))

    # Second pass: collect imports and calls
    def visit_node(node, current_symbol: str | None = None):
        """Recursively visit nodes to find imports and calls."""
        if node.type == "import_statement":
            source_node = node.child_by_field_name("source")
            if source_node and source_node.type == "string":
                # Extract the string content without quotes
                text = get_text(source_node)
                # Remove quotes
                module = text[1:-1] if len(text) > 2 else text
                line = node.start_point[0] + 1
                imports.append(RawImport(module, line))

        elif node.type == "call_expression":
            func_node = node.child_by_field_name("function")

            if func_node:
                callee = None
                receiver = None
                if func_node.type == "identifier":
                    callee = get_text(func_node)
                elif func_node.type == "member_expression":
                    # Get the property field
                    prop_node = func_node.child_by_field_name("property")
                    if prop_node and prop_node.type == "property_identifier":
                        callee = get_text(prop_node)
                        receiver = _receiver_name(
                            func_node.child_by_field_name("object"), get_text
                        )

                if callee:
                    line = node.start_point[0] + 1
                    calls.append(RawCall(callee, current_symbol, line, receiver))

        # Recurse
        for child in node.children:
            visit_node(child, current_symbol)

    # Visit root's direct children to find imports and top-level calls
    for child in root.children:
        if child.type == "class_declaration":
            name = get_name(child)
            for subchild in child.children:
                visit_node(subchild, name)
        elif child.type == "function_declaration":
            name = get_name(child)
            for subchild in child.children:
                visit_node(subchild, name)
        elif child.type == "export_statement":
            # Find the target inside export
            for subchild in child.children:
                if subchild.type == "class_declaration":
                    name = get_name(subchild)
                    for subsubchild in subchild.children:
                        visit_node(subsubchild, name)
                elif subchild.type == "function_declaration":
                    name = get_name(subchild)
                    for subsubchild in subchild.children:
                        visit_node(subsubchild, name)
        else:
            visit_node(child, None)
