use serde::Serialize;
use std::collections::{HashMap, HashSet};

/// Text extracted from a single block.
#[derive(Debug, Clone)]
pub struct BlockText {
    pub block_id: String,
    pub text: String,
    /// true if this text came from an edgeless surface element
    pub is_surface: bool,
}

/// Cached text data for a single note.
#[derive(Debug, Clone)]
pub struct NoteText {
    pub text: String,
    pub tokens: Vec<String>,
    pub title: String,
    pub updated_at: u64,
    pub blocks: Vec<BlockText>,
}

/// In-memory search index. Holds extracted text for all notes.
#[derive(Debug, Default)]
pub struct SearchIndex {
    entries: HashMap<String, NoteText>,
}

impl SearchIndex {
    pub fn new() -> Self {
        Self { entries: HashMap::new() }
    }

    /// Insert or update a note's text in the index.
    /// Call this from save_note with the raw Yjs binary.
    pub fn index_note(&mut self, id: &str, title: &str, updated_at: u64, yjs_data: &[u8]) {
        let blocks = extract_blocks_from_yjs(yjs_data);
        let text: String = blocks.iter().map(|b| b.text.as_str()).collect::<Vec<_>>().join("\n");
        let tokens = tokenize(&text);
        self.entries.insert(id.to_string(), NoteText {
            text,
            tokens,
            title: title.to_string(),
            updated_at,
            blocks,
        });
    }

    /// Index a note using just metadata (no binary data available).
    pub fn index_note_meta(&mut self, id: &str, title: &str, preview: &str, updated_at: u64) {
        let text = format!("{}\n{}", title, preview);
        let tokens = tokenize(&text);
        self.entries.insert(id.to_string(), NoteText {
            text,
            tokens,
            title: title.to_string(),
            updated_at,
            blocks: vec![],
        });
    }

    /// Remove a note from the index.
    pub fn remove(&mut self, id: &str) {
        self.entries.remove(id);
    }

    /// Number of indexed notes.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Search the in-memory index. No disk I/O.
    pub fn search(&self, query: &str) -> Vec<SearchResult> {
        if query.trim().is_empty() {
            return vec![];
        }

        let query_tokens = tokenize(query);
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as f64;

        let mut results: Vec<SearchResult> = self.entries.iter()
            .filter_map(|(id, note)| {
                let score = compute_score(query, &query_tokens, &note.text, &note.tokens, &note.title);
                if score <= 0.0 { return None; }

                let days = (now_ms - note.updated_at as f64) / (1000.0 * 60.0 * 60.0 * 24.0);
                let recency = (1.0 - days / 365.0).max(0.0);

                let (match_block_id, is_surface) = find_matching_block(&note.blocks, query);
                let match_mode = match_block_id.as_ref().map(|_| {
                    if is_surface { "edgeless".to_string() } else { "page".to_string() }
                });

                Some(SearchResult {
                    note_id: id.clone(),
                    title: if note.title.is_empty() { "Untitled".to_string() } else { note.title.clone() },
                    score: score + recency * 0.5,
                    snippet: find_snippet(&note.text, query),
                    match_block_id,
                    match_mode,
                    updated_at: note.updated_at,
                })
            })
            .collect();

        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        results
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub note_id: String,
    pub title: String,
    pub score: f64,
    pub snippet: String,
    pub match_block_id: Option<String>,
    /// "page" or "edgeless" — which editor mode shows the matched block
    pub match_mode: Option<String>,
    pub updated_at: u64,
}

// ===== Yjs text extraction using direct MapRef/TextRef API =====

use yrs::{Array, Doc, GetString, Map, ReadTxn, Transact};
use yrs::updates::decoder::Decode;

fn extract_blocks_from_yjs(data: &[u8]) -> Vec<BlockText> {
    let doc = Doc::new();
    {
        let mut txn = doc.transact_mut();
        let update = match yrs::Update::decode_v1(data) {
            Ok(u) => u,
            Err(_) => return vec![],
        };
        if txn.apply_update(update).is_err() {
            return vec![];
        }
    }

    let txn = doc.transact();
    let blocks = match txn.get_map("blocks") {
        Some(b) => b,
        None => return vec![],
    };

    let mut result = Vec::new();

    // Collect all block IDs and find the root
    let mut root_id: Option<String> = None;
    let mut block_ids: Vec<String> = Vec::new();

    for (key, value) in blocks.iter(&txn) {
        block_ids.push(key.to_string());
        if let yrs::Out::YMap(block) = value {
            if let Some(yrs::Out::Any(yrs::Any::String(flavour))) = block.get(&txn, "sys:flavour") {
                if flavour.as_ref() == "affine:page" {
                    root_id = Some(key.to_string());
                }
            }
        }
    }

    if let Some(rid) = root_id {
        collect_blocks_recursive(&txn, &blocks, &rid, &mut result);
    } else {
        for key in &block_ids {
            if let Some(yrs::Out::YMap(block)) = blocks.get(&txn, key.as_str()) {
                let text = extract_block_text(&txn, &block);
                if !text.is_empty() {
                    result.push(BlockText { block_id: key.clone(), text, is_surface: false });
                }
            }
        }
    }

    result
}

/// Container flavours whose DOM element wraps the entire page/note — skip these
/// so we only highlight leaf content blocks.
const CONTAINER_FLAVOURS: &[&str] = &["affine:page", "affine:note", "affine:surface"];

fn collect_blocks_recursive<T: ReadTxn>(
    txn: &T,
    blocks: &yrs::MapRef,
    block_id: &str,
    result: &mut Vec<BlockText>,
) {
    let block = match blocks.get(txn, block_id) {
        Some(yrs::Out::YMap(b)) => b,
        _ => return,
    };

    let flavour = block.get(txn, "sys:flavour")
        .and_then(|v| if let yrs::Out::Any(yrs::Any::String(s)) = v { Some(s.to_string()) } else { None })
        .unwrap_or_default();

    let is_container = CONTAINER_FLAVOURS.iter().any(|c| flavour.as_str() == *c);

    // Extract text from surface elements (shapes, text, connectors, frames in edgeless)
    if flavour == "affine:surface" {
        extract_surface_elements(txn, &block, result);
    }

    if !is_container {
        let text = extract_block_text(txn, &block);
        if !text.is_empty() {
            result.push(BlockText { block_id: block_id.to_string(), text, is_surface: false });
        }
    }

    if let Some(yrs::Out::YArray(children)) = block.get(txn, "sys:children") {
        for child in children.iter(txn) {
            if let yrs::Out::Any(yrs::Any::String(child_id)) = child {
                collect_blocks_recursive(txn, blocks, child_id.as_ref(), result);
            }
        }
    }
}

/// Extract text from edgeless surface elements (shapes, text, connectors, groups).
/// The elements are stored in prop:elements as a Boxed Y.Map:
///   prop:elements -> Y.Map { type: "...", value: Y.Map { elementId: Y.Map { text: Y.Text, ... } } }
fn extract_surface_elements<T: ReadTxn>(
    txn: &T,
    surface_block: &yrs::MapRef,
    result: &mut Vec<BlockText>,
) {
    // prop:elements is a Boxed wrapper — a Y.Map with a "value" key holding the inner Y.Map
    let boxed = match surface_block.get(txn, "prop:elements") {
        Some(yrs::Out::YMap(m)) => m,
        _ => return,
    };

    let elements = match boxed.get(txn, "value") {
        Some(yrs::Out::YMap(m)) => m,
        _ => return,
    };

    for (elem_id, elem_val) in elements.iter(txn) {
        if let yrs::Out::YMap(elem) = elem_val {
            let mut parts = Vec::new();

            // "text" — used by shape, text element, and connector labels
            if let Some(yrs::Out::YText(ytext)) = elem.get(txn, "text") {
                let s = ytext.get_string(txn);
                let trimmed = s.trim();
                if !trimmed.is_empty() {
                    parts.push(trimmed.to_string());
                }
            }

            // "title" — used by group elements and frames
            if let Some(yrs::Out::YText(ytext)) = elem.get(txn, "title") {
                let s = ytext.get_string(txn);
                let trimmed = s.trim();
                if !trimmed.is_empty() {
                    parts.push(trimmed.to_string());
                }
            }

            if !parts.is_empty() {
                result.push(BlockText {
                    block_id: elem_id.to_string(),
                    text: parts.join(" "),
                    is_surface: true,
                });
            }
        }
    }
}

fn extract_block_text<T: ReadTxn>(
    txn: &T,
    block: &yrs::MapRef,
) -> String {
    let mut parts = Vec::new();

    for key in &["prop:title", "prop:text", "prop:caption"] {
        if let Some(yrs::Out::YText(ytext)) = block.get(txn, *key) {
            let s = ytext.get_string(txn);
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                parts.push(trimmed.to_string());
            }
        }
    }

    for key in &["prop:url", "prop:description", "prop:name"] {
        if let Some(yrs::Out::Any(yrs::Any::String(s))) = block.get(txn, *key) {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                parts.push(trimmed.to_string());
            }
        }
    }

    parts.join(" ")
}

/// Find the block whose text best matches the query.
/// Returns (block_id, is_surface).
fn find_matching_block(blocks: &[BlockText], query: &str) -> (Option<String>, bool) {
    if blocks.is_empty() {
        return (None, false);
    }
    let lq = query.to_lowercase();
    // Prefer exact substring match
    for b in blocks {
        if b.text.to_lowercase().contains(&lq) {
            return (Some(b.block_id.clone()), b.is_surface);
        }
    }
    // Fall back to best word overlap
    let query_tokens = tokenize(query);
    let mut best: Option<&BlockText> = None;
    let mut best_score = 0usize;
    for b in blocks {
        let bt = b.text.to_lowercase();
        let count = query_tokens.iter().filter(|qt| bt.contains(qt.as_str())).count();
        if count > best_score {
            best_score = count;
            best = Some(b);
        }
    }
    match best {
        Some(b) => (Some(b.block_id.clone()), b.is_surface),
        None => (None, false),
    }
}

// ===== Scoring =====

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.len() > 1)
        .map(|t| t.to_string())
        .collect()
}

fn term_freq(tokens: &[String]) -> HashMap<String, u32> {
    let mut freq = HashMap::new();
    for t in tokens {
        *freq.entry(t.clone()).or_insert(0) += 1;
    }
    freq
}

fn bigrams(s: &str) -> HashSet<[u8; 2]> {
    let bytes = s.as_bytes();
    let mut set = HashSet::new();
    if bytes.len() >= 2 {
        for i in 0..bytes.len() - 1 {
            set.insert([bytes[i], bytes[i + 1]]);
        }
    }
    set
}

fn compute_score(query: &str, query_tokens: &[String], doc_text: &str, doc_tokens: &[String], title: &str) -> f64 {
    if doc_tokens.is_empty() && title.is_empty() {
        return 0.0;
    }

    let lq = query.to_lowercase();
    let ld = doc_text.to_lowercase();
    let lt = title.to_lowercase();

    let mut score = 0.0;

    if lt.contains(&lq) { score += 15.0; }
    if ld.contains(&lq) { score += 10.0; }

    let doc_freq = term_freq(doc_tokens);
    let title_tokens = tokenize(title);
    let title_freq = term_freq(&title_tokens);

    for qt in query_tokens {
        if title_freq.contains_key(qt) { score += 5.0; }
        if let Some(&count) = doc_freq.get(qt) {
            score += 3.0 * (1.0 + (1.0 + count as f64).ln());
        }
        for (term, &freq) in &doc_freq {
            if term != qt && term.len() > 2 && (term.starts_with(qt.as_str()) || qt.starts_with(term.as_str())) {
                score += 1.5 * (1.0 + (1.0 + freq as f64).ln());
            }
        }
    }

    // Bigram fuzzy on title
    let qbg = bigrams(&lq);
    let tbg = bigrams(&lt);
    if !qbg.is_empty() && !tbg.is_empty() {
        let inter = qbg.intersection(&tbg).count();
        score += (2 * inter) as f64 / (qbg.len() + tbg.len()) as f64 * 8.0;
    }

    // Per-word bigram fuzzy on doc
    for qt in query_tokens {
        let qb = bigrams(qt);
        if qb.is_empty() { continue; }
        let mut best = 0.0f64;
        for term in doc_freq.keys() {
            let tb = bigrams(term);
            if tb.is_empty() { continue; }
            let inter = qb.intersection(&tb).count();
            let sim = (2 * inter) as f64 / (qb.len() + tb.len()) as f64;
            if sim > best { best = sim; }
        }
        if best > 0.5 { score += best * 2.0; }
    }

    score
}

fn find_snippet(doc_text: &str, query: &str) -> String {
    let ld = doc_text.to_lowercase();
    let lq = query.to_lowercase();

    if let Some(idx) = ld.find(&lq) {
        return make_snippet(doc_text, idx, query.len());
    }

    for word in lq.split_whitespace().filter(|w| w.len() > 1) {
        if let Some(idx) = ld.find(word) {
            return make_snippet(doc_text, idx, word.len());
        }
    }

    let fallback: String = doc_text.replace('\n', " ").chars().take(120).collect();
    if doc_text.len() > 120 {
        format!("{}...", fallback.trim())
    } else {
        fallback.trim().to_string()
    }
}

fn make_snippet(text: &str, match_start: usize, match_len: usize) -> String {
    let start = match_start.saturating_sub(40);
    let end = (match_start + match_len + 80).min(text.len());
    // Ensure we don't split in the middle of a multi-byte char
    let start = text.floor_char_boundary(start);
    let end = text.ceil_char_boundary(end);
    let mut snippet: String = text[start..end].replace('\n', " ");
    snippet = snippet.trim().to_string();
    if start > 0 { snippet = format!("...{}", snippet); }
    if end < text.len() { snippet = format!("{}...", snippet); }
    snippet
}
