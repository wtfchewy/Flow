#!/usr/bin/env node

/**
 * Seed script — populates Peak with 25 rich notes for testing search.
 *
 * Usage:
 *   node scripts/seed-notes.mjs
 *
 * Writes directly to ~/Library/Application Support/Peak/notes/
 * and updates notes-index.json. Close the app first.
 */

import * as Y from 'yjs';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const NOTES_DIR = join(homedir(), 'Library', 'Application Support', 'com.peak.notes', 'notes');
const INDEX_PATH = join(homedir(), 'Library', 'Application Support', 'com.peak.notes', 'notes-index.json');

mkdirSync(NOTES_DIR, { recursive: true });

// Load existing index
let existingIndex = [];
if (existsSync(INDEX_PATH)) {
  try {
    existingIndex = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  } catch { /* ignore */ }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

let blockCounter = 0;
function blockId() {
  return `block-${Date.now().toString(36)}-${(blockCounter++).toString(36)}`;
}

/**
 * Create a BlockSuite-compatible Yjs document.
 * Returns { ydoc, title, preview }
 */
function createNote(title, contentFn) {
  const ydoc = new Y.Doc();
  const blocks = ydoc.getMap('blocks');

  const rootId = blockId();
  const surfaceId = blockId();
  const noteId = blockId();

  // Root block (affine:page)
  const rootBlock = new Y.Map();
  rootBlock.set('sys:id', rootId);
  rootBlock.set('sys:flavour', 'affine:page');
  rootBlock.set('sys:version', 2);
  const rootChildren = new Y.Array();
  rootChildren.push([surfaceId, noteId]);
  rootBlock.set('sys:children', rootChildren);
  const titleText = new Y.Text();
  titleText.insert(0, title);
  rootBlock.set('prop:title', titleText);
  blocks.set(rootId, rootBlock);

  // Surface block
  const surfaceBlock = new Y.Map();
  surfaceBlock.set('sys:id', surfaceId);
  surfaceBlock.set('sys:flavour', 'affine:surface');
  surfaceBlock.set('sys:version', 5);
  surfaceBlock.set('sys:children', new Y.Array());
  const elements = new Y.Map();
  surfaceBlock.set('prop:elements', elements);
  blocks.set(surfaceId, surfaceBlock);

  // Note block (container)
  const noteBlock = new Y.Map();
  noteBlock.set('sys:id', noteId);
  noteBlock.set('sys:flavour', 'affine:note');
  noteBlock.set('sys:version', 1);
  const noteChildren = new Y.Array();
  noteBlock.set('sys:children', noteChildren);
  noteBlock.set('prop:xywh', '[0,0,800,640]');
  noteBlock.set('prop:background', '--affine-note-background-white');
  noteBlock.set('prop:index', 'a0');
  noteBlock.set('prop:displayMode', 'both');
  noteBlock.set('prop:hidden', false);
  noteBlock.set('prop:edgeless', new Y.Map());
  blocks.set(noteId, noteBlock);

  // Helper to add blocks
  let firstPreview = '';

  function addParagraph(text, type = 'text') {
    const id = blockId();
    const block = new Y.Map();
    block.set('sys:id', id);
    block.set('sys:flavour', 'affine:paragraph');
    block.set('sys:version', 1);
    block.set('sys:children', new Y.Array());
    block.set('prop:type', type);
    const ytext = new Y.Text();
    ytext.insert(0, text);
    block.set('prop:text', ytext);
    blocks.set(id, block);
    noteChildren.push([id]);
    if (!firstPreview && type === 'text') firstPreview = text;
    return id;
  }

  function addList(text, type = 'bulleted', checked = false) {
    const id = blockId();
    const block = new Y.Map();
    block.set('sys:id', id);
    block.set('sys:flavour', 'affine:list');
    block.set('sys:version', 1);
    block.set('sys:children', new Y.Array());
    block.set('prop:type', type);
    block.set('prop:checked', checked);
    block.set('prop:collapsed', false);
    const ytext = new Y.Text();
    ytext.insert(0, text);
    block.set('prop:text', ytext);
    blocks.set(id, block);
    noteChildren.push([id]);
    return id;
  }

  function addCode(text, language = 'javascript') {
    const id = blockId();
    const block = new Y.Map();
    block.set('sys:id', id);
    block.set('sys:flavour', 'affine:code');
    block.set('sys:version', 1);
    block.set('sys:children', new Y.Array());
    block.set('prop:language', language);
    block.set('prop:wrap', false);
    const ytext = new Y.Text();
    ytext.insert(0, text);
    block.set('prop:text', ytext);
    blocks.set(id, block);
    noteChildren.push([id]);
    return id;
  }

  function addDivider() {
    const id = blockId();
    const block = new Y.Map();
    block.set('sys:id', id);
    block.set('sys:flavour', 'affine:divider');
    block.set('sys:version', 1);
    block.set('sys:children', new Y.Array());
    blocks.set(id, block);
    noteChildren.push([id]);
    return id;
  }

  contentFn({ addParagraph, addList, addCode, addDivider });

  const preview = firstPreview.slice(0, 100);
  return { ydoc, title, preview };
}

// ===== 25 diverse notes =====

const notes = [
  () => createNote('Project Architecture Overview', ({ addParagraph, addList, addCode, addDivider }) => {
    addParagraph('System Architecture', 'h1');
    addParagraph('This document outlines the core architecture of our distributed microservices platform. The system is designed to handle millions of concurrent users while maintaining sub-100ms response times across all critical paths.');
    addParagraph('Core Components', 'h2');
    addList('API Gateway — handles authentication, rate limiting, and request routing');
    addList('User Service — manages user profiles, preferences, and session state');
    addList('Content Service — stores and retrieves documents with full-text search');
    addList('Notification Service — real-time push notifications via WebSockets');
    addList('Analytics Pipeline — event ingestion and real-time dashboards');
    addDivider();
    addParagraph('Technology Stack', 'h2');
    addParagraph('We chose Rust for performance-critical services and TypeScript for rapid iteration on business logic. The combination gives us the best of both worlds: native performance where it matters and developer velocity where it counts.');
    addCode('// Service registry configuration\nconst services = {\n  gateway: { port: 8080, replicas: 3 },\n  users: { port: 8081, replicas: 2 },\n  content: { port: 8082, replicas: 4 },\n  notifications: { port: 8083, replicas: 2 },\n  analytics: { port: 8084, replicas: 1 },\n};', 'typescript');
    addParagraph('Deployment Strategy', 'h2');
    addParagraph('All services are containerized with Docker and orchestrated via Kubernetes. We use a blue-green deployment strategy with automatic rollback on health check failures. Each service has its own CI/CD pipeline with unit tests, integration tests, and canary deployments.');
  }),

  () => createNote('Weekly Meeting Notes — Sprint 47', ({ addParagraph, addList, addDivider }) => {
    addParagraph('Sprint 47 Standup', 'h1');
    addParagraph('Date: Monday, March 31, 2026');
    addParagraph('Attendees: Sarah, Mike, Priya, James, Chen');
    addDivider();
    addParagraph('Progress Updates', 'h2');
    addParagraph('Sarah presented the new onboarding flow redesign. Conversion metrics from the A/B test show a 23% improvement in activation rate. The team agreed to ship this to 100% of users by Wednesday.');
    addParagraph('Mike flagged a memory leak in the WebSocket connection handler. It accumulates approximately 2MB per hour under sustained load. He has a fix ready for review.');
    addParagraph('Priya completed the database migration script for the new schema. All 47 million records migrated successfully in staging with zero data loss. Production migration scheduled for Saturday maintenance window.');
    addDivider();
    addParagraph('Action Items', 'h2');
    addList('Sarah: Ship onboarding redesign to 100%', 'todo', false);
    addList('Mike: Submit PR for WebSocket memory leak fix', 'todo', true);
    addList('Priya: Run production migration Saturday 2am EST', 'todo', false);
    addList('James: Update monitoring dashboards for new metrics', 'todo', false);
    addList('Chen: Write post-mortem for Friday incident', 'todo', true);
    addDivider();
    addParagraph('Blockers', 'h2');
    addParagraph('The third-party payment processor is experiencing intermittent 502 errors. We have opened a support ticket and implemented a retry mechanism with exponential backoff as a temporary workaround.');
  }),

  () => createNote('Rust Ownership and Borrowing Guide', ({ addParagraph, addCode, addList, addDivider }) => {
    addParagraph('Understanding Ownership in Rust', 'h1');
    addParagraph('Ownership is Rust\'s most unique feature. It enables Rust to make memory safety guarantees without needing a garbage collector. Understanding ownership is essential for writing idiomatic Rust code.');
    addParagraph('The Three Rules', 'h2');
    addList('Each value in Rust has a variable that\'s called its owner', 'numbered');
    addList('There can only be one owner at a time', 'numbered');
    addList('When the owner goes out of scope, the value will be dropped', 'numbered');
    addDivider();
    addParagraph('Move Semantics', 'h2');
    addParagraph('When you assign a value to another variable, Rust moves the ownership. The original variable can no longer be used.');
    addCode('fn main() {\n    let s1 = String::from("hello");\n    let s2 = s1; // s1 is moved to s2\n    // println!("{}", s1); // ERROR: s1 no longer valid\n    println!("{}", s2); // OK\n}', 'rust');
    addParagraph('Borrowing', 'h2');
    addParagraph('Instead of transferring ownership, you can borrow a reference. Immutable borrows (&T) allow reading, mutable borrows (&mut T) allow modification.');
    addCode('fn calculate_length(s: &String) -> usize {\n    s.len() // we can read s, but not modify it\n}\n\nfn append_world(s: &mut String) {\n    s.push_str(" world"); // mutable borrow allows modification\n}', 'rust');
    addParagraph('Lifetimes', 'h2');
    addParagraph('Lifetimes are Rust\'s way of ensuring references are always valid. The borrow checker uses lifetimes to prevent dangling references at compile time.');
    addCode('fn longest<\'a>(x: &\'a str, y: &\'a str) -> &\'a str {\n    if x.len() > y.len() { x } else { y }\n}', 'rust');
  }),

  () => createNote('Recipe: Homemade Sourdough Bread', ({ addParagraph, addList, addDivider }) => {
    addParagraph('Sourdough Bread Recipe', 'h1');
    addParagraph('This recipe produces a beautifully crusty loaf with an open crumb structure. The entire process takes about 24 hours from start to finish, but most of that is hands-off fermentation time.');
    addParagraph('Ingredients', 'h2');
    addList('500g bread flour (12-13% protein)');
    addList('350g water at 78°F (75% hydration)');
    addList('100g active sourdough starter');
    addList('10g fine sea salt');
    addDivider();
    addParagraph('Day 1 — Evening', 'h2');
    addParagraph('Mix flour and water, let it rest 30 minutes (autolyse). This allows the flour to fully hydrate and develops gluten without kneading. After autolyse, add the starter and salt. Perform 4 sets of stretch and folds at 30-minute intervals.');
    addParagraph('Bulk fermentation takes 4-6 hours at room temperature (75°F). The dough should increase in volume by 50-75% and show visible bubbles on the surface and sides.');
    addDivider();
    addParagraph('Day 2 — Morning', 'h2');
    addParagraph('Pre-shape the dough into a round on an unfloured surface. Let it rest 20 minutes. Final shape into a tight boule and place seam-side up in a floured banneton. Cold retard in the refrigerator for 12-16 hours.');
    addParagraph('Baking', 'h2');
    addParagraph('Preheat Dutch oven at 500°F for 45 minutes. Score the dough with a sharp blade. Bake covered 20 minutes, then uncovered at 450°F for 25 minutes until deep golden brown. Internal temperature should reach 210°F. Let cool completely on a wire rack before slicing — at least 1 hour.');
  }),

  () => createNote('Machine Learning Pipeline Design', ({ addParagraph, addCode, addList, addDivider }) => {
    addParagraph('ML Pipeline Architecture', 'h1');
    addParagraph('Designing a production machine learning pipeline requires careful consideration of data flow, feature engineering, model training, validation, and deployment. This document covers our end-to-end pipeline for the recommendation system.');
    addParagraph('Data Ingestion', 'h2');
    addParagraph('Raw events from the application are streamed via Kafka into our data lake. We process approximately 50 million events per day across user interactions, content views, and purchase signals.');
    addCode('# Feature extraction pipeline\nimport pandas as pd\nfrom sklearn.preprocessing import StandardScaler\n\ndef extract_features(events_df: pd.DataFrame) -> pd.DataFrame:\n    user_features = events_df.groupby("user_id").agg(\n        total_views=("event_type", lambda x: (x == "view").sum()),\n        total_purchases=("event_type", lambda x: (x == "purchase").sum()),\n        avg_session_duration=("duration_ms", "mean"),\n        unique_categories=("category", "nunique"),\n    )\n    scaler = StandardScaler()\n    return pd.DataFrame(\n        scaler.fit_transform(user_features),\n        columns=user_features.columns,\n        index=user_features.index,\n    )', 'python');
    addDivider();
    addParagraph('Model Training', 'h2');
    addParagraph('We use a two-tower neural network architecture. The user tower encodes user features and behavior history. The item tower encodes content metadata and engagement signals. The dot product of both towers produces relevance scores.');
    addList('Training data: 90 days of user-item interactions');
    addList('Validation: 7-day holdout with A/B test correlation');
    addList('Metrics: NDCG@10, MAP@20, Click-through rate');
    addList('Retraining cadence: Weekly with daily incremental updates');
    addParagraph('Deployment', 'h2');
    addParagraph('Models are served via TensorFlow Serving behind an Envoy proxy. We use shadow mode for 24 hours before promoting a new model to production. Latency budget is 15ms p99 for inference.');
  }),

  () => createNote('Japanese Garden Design Principles', ({ addParagraph, addList, addDivider }) => {
    addParagraph('Principles of Japanese Garden Design', 'h1');
    addParagraph('Japanese gardens are not merely decorative landscapes — they are meditative spaces designed to evoke the essence of nature. Every element is placed with intention, following centuries-old principles that balance aesthetic beauty with philosophical depth.');
    addParagraph('Core Principles', 'h2');
    addList('Asymmetry (Fukinsei) — nature is never perfectly symmetrical');
    addList('Simplicity (Kanso) — eliminate the unnecessary, embrace restraint');
    addList('Natural aging (Wabi) — weathered materials tell stories of time');
    addList('Subtlety (Shibui) — beauty that reveals itself slowly');
    addList('Stillness (Seijaku) — tranquility as the foundation of design');
    addDivider();
    addParagraph('Key Elements', 'h2');
    addParagraph('Water represents the flow of life and is the central element in most Japanese gardens. Still water in ponds reflects the sky and surrounding trees, creating a sense of depth and contemplation. Running water in streams adds dynamic energy and the meditative sound of flowing water.');
    addParagraph('Rocks and stones serve as the bones of the garden. Each stone is carefully selected and positioned to suggest mountains, islands, or abstract forms. In dry gardens (karesansui), raked gravel represents water and waves.');
    addParagraph('Plants are chosen for their seasonal characteristics. Cherry blossoms for spring, maples for autumn, evergreen pines for year-round structure. Moss carpets create a sense of age and tranquility.');
    addDivider();
    addParagraph('The borrowed view technique (shakkei) incorporates distant landscape elements — mountains, forests, or even clouds — as part of the garden composition, expanding the perceived space infinitely beyond its physical boundaries.');
  }),

  () => createNote('Database Query Optimization Notes', ({ addParagraph, addCode, addList, addDivider }) => {
    addParagraph('PostgreSQL Query Optimization', 'h1');
    addParagraph('Performance analysis of slow queries in our production database. The orders table has 180 million rows and several queries are exceeding our 200ms SLA.');
    addParagraph('Problem Query', 'h2');
    addCode('-- Original: 4.2 seconds\nSELECT o.id, o.total, u.name, u.email\nFROM orders o\nJOIN users u ON u.id = o.user_id\nWHERE o.created_at > NOW() - INTERVAL \'30 days\'\n  AND o.status = \'completed\'\n  AND o.total > 100\nORDER BY o.created_at DESC\nLIMIT 50;', 'sql');
    addParagraph('EXPLAIN ANALYZE showed a sequential scan on orders followed by a nested loop join. The query planner estimated 1.2M rows but actually touched 8.4M rows.');
    addDivider();
    addParagraph('Optimizations Applied', 'h2');
    addList('Created composite index on (status, created_at DESC, total)');
    addList('Added covering index to include user_id to avoid table lookup');
    addList('Partitioned orders table by month using range partitioning');
    addList('Updated statistics with ANALYZE after index creation');
    addCode('-- Optimized indexes\nCREATE INDEX idx_orders_status_date_total\n  ON orders (status, created_at DESC, total)\n  WHERE status = \'completed\';\n\nCREATE INDEX idx_orders_covering\n  ON orders (status, created_at DESC)\n  INCLUDE (total, user_id)\n  WHERE status = \'completed\';', 'sql');
    addParagraph('Results', 'h2');
    addParagraph('Query time dropped from 4.2 seconds to 12 milliseconds. The partial index reduced index size by 60% since most orders are completed. Table partitioning allowed the planner to prune 11 of 12 monthly partitions.');
  }),

  () => createNote('Reading List 2026', ({ addParagraph, addList, addDivider }) => {
    addParagraph('Books to Read in 2026', 'h1');
    addParagraph('Keeping track of books I want to read, am currently reading, and have finished this year.');
    addParagraph('Currently Reading', 'h2');
    addList('The Pragmatic Programmer (20th Anniversary Edition) — David Thomas & Andrew Hunt', 'todo', false);
    addList('Designing Data-Intensive Applications — Martin Kleppmann', 'todo', false);
    addDivider();
    addParagraph('Completed', 'h2');
    addList('Project Hail Mary — Andy Weir (loved it, the alien language bits were fascinating)', 'todo', true);
    addList('Atomic Habits — James Clear (practical frameworks for behavior change)', 'todo', true);
    addList('The Art of PostgreSQL — Dimitri Fontaine (excellent deep dive into SQL)', 'todo', true);
    addList('Staff Engineer — Will Larson (helpful for career growth perspective)', 'todo', true);
    addList('Thinking, Fast and Slow — Daniel Kahneman (dense but worthwhile)', 'todo', true);
    addDivider();
    addParagraph('Want to Read', 'h2');
    addList('A Philosophy of Software Design — John Ousterhout');
    addList('Crafting Interpreters — Robert Nystrom');
    addList('The Mythical Man-Month — Fred Brooks');
    addList('Structure and Interpretation of Computer Programs');
    addList('Gödel, Escher, Bach — Douglas Hofstadter');
    addList('Klara and the Sun — Kazuo Ishiguro');
    addList('The Three-Body Problem — Cixin Liu');
  }),

  () => createNote('Kubernetes Cluster Troubleshooting', ({ addParagraph, addCode, addList, addDivider }) => {
    addParagraph('K8s Production Incident Report', 'h1');
    addParagraph('On April 2nd at 14:23 UTC, the production cluster experienced cascading pod failures affecting 40% of user-facing services. This document captures the timeline, root cause, and remediation steps.');
    addParagraph('Timeline', 'h2');
    addList('14:23 — PagerDuty alert: API latency exceeds 5s threshold', 'numbered');
    addList('14:25 — Investigation reveals 12 pods in CrashLoopBackOff', 'numbered');
    addList('14:28 — Node memory pressure detected on 3 of 8 worker nodes', 'numbered');
    addList('14:35 — Identified rogue batch job consuming 32GB per pod', 'numbered');
    addList('14:38 — Killed batch job, pods begin recovering', 'numbered');
    addList('14:45 — All services healthy, latency normalized', 'numbered');
    addDivider();
    addParagraph('Root Cause', 'h2');
    addParagraph('A data processing batch job was deployed without resource limits. Each pod requested the default 256Mi but consumed up to 32Gi, triggering OOM kills on co-located pods. The eviction cascade spread across nodes as the scheduler attempted to reschedule evicted pods.');
    addCode('# The problematic deployment (no resource limits)\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: data-processor\nspec:\n  replicas: 4\n  template:\n    spec:\n      containers:\n      - name: processor\n        image: data-processor:latest\n        # Missing: resources.limits\n        # Missing: resources.requests', 'yaml');
    addParagraph('Remediation', 'h2');
    addList('Added LimitRange to enforce default resource limits per namespace');
    addList('Implemented ResourceQuota to cap total namespace resource usage');
    addList('Added OPA Gatekeeper policy to reject pods without resource limits');
    addList('Created dedicated node pool for batch workloads with taints/tolerations');
  }),

  () => createNote('TypeScript Advanced Patterns', ({ addParagraph, addCode, addDivider }) => {
    addParagraph('Advanced TypeScript Patterns', 'h1');
    addParagraph('A collection of advanced TypeScript patterns I keep coming back to. These patterns leverage the type system to catch bugs at compile time rather than runtime.');
    addParagraph('Branded Types', 'h2');
    addParagraph('Branded types prevent accidentally mixing up values that share the same underlying type. For example, user IDs and post IDs are both strings, but should never be interchangeable.');
    addCode('type Brand<T, B> = T & { __brand: B };\n\ntype UserId = Brand<string, "UserId">;\ntype PostId = Brand<string, "PostId">;\n\nfunction getUser(id: UserId) { /* ... */ }\nfunction getPost(id: PostId) { /* ... */ }\n\nconst userId = "abc" as UserId;\nconst postId = "xyz" as PostId;\n\ngetUser(userId);  // OK\n// getUser(postId); // ERROR: PostId not assignable to UserId', 'typescript');
    addDivider();
    addParagraph('Discriminated Unions', 'h2');
    addParagraph('Discriminated unions combined with exhaustive checking ensure you handle every possible state. The compiler will error if you add a new variant without handling it everywhere.');
    addCode('type Result<T, E> =\n  | { kind: "ok"; value: T }\n  | { kind: "err"; error: E };\n\nfunction handle<T, E>(result: Result<T, E>) {\n  switch (result.kind) {\n    case "ok":\n      console.log(result.value);\n      break;\n    case "err":\n      console.error(result.error);\n      break;\n    default:\n      const _exhaustive: never = result;\n  }\n}', 'typescript');
    addDivider();
    addParagraph('Builder Pattern with Method Chaining', 'h2');
    addCode('class QueryBuilder<T extends Record<string, unknown>> {\n  private filters: Partial<T> = {};\n\n  where<K extends keyof T>(key: K, value: T[K]): this {\n    this.filters[key] = value;\n    return this;\n  }\n\n  build(): Partial<T> {\n    return { ...this.filters };\n  }\n}\n\nconst query = new QueryBuilder<{ name: string; age: number }>()\n  .where("name", "Alice")\n  .where("age", 30)\n  .build();', 'typescript');
  }),

  () => createNote('Fitness Training Log — March 2026', ({ addParagraph, addList, addDivider }) => {
    addParagraph('March Training Log', 'h1');
    addParagraph('Tracking workouts, recovery, and progress toward the April half marathon goal. Current weekly mileage: 35 miles.');
    addParagraph('Week 1 (March 1-7)', 'h2');
    addList('Monday: Easy 5 miles, 8:45/mi pace. Felt good, legs fresh from rest day.');
    addList('Tuesday: Track intervals — 8x400m at 6:30/mi with 200m jog recovery. Hit all splits.');
    addList('Wednesday: Cross-training — 45 min cycling + yoga');
    addList('Thursday: Tempo run 7 miles, 7:30/mi. Struggled in miles 5-6, need to fuel better.');
    addList('Friday: Rest day. Foam rolling and stretching.');
    addList('Saturday: Long run 12 miles, 8:30/mi. Perfect weather, 52°F and overcast.');
    addList('Sunday: Recovery 3 miles, very easy pace.');
    addDivider();
    addParagraph('Week 2 (March 8-14)', 'h2');
    addList('Monday: Easy 6 miles with strides. New shoes feel great after 20 miles of break-in.');
    addList('Tuesday: Hill repeats — 6x 90sec uphill at threshold effort. Quads are toast.');
    addList('Wednesday: Rest. Left achilles felt tight, iced and rolled it.');
    addList('Thursday: Easy 5 miles. Achilles fine, just needed the extra rest.');
    addList('Friday: Tempo 8 miles at 7:25/mi. Big improvement from last week!');
    addList('Saturday: Long run 14 miles, 8:40/mi. Practiced race nutrition strategy.');
    addList('Sunday: Easy 4 miles recovery.');
    addDivider();
    addParagraph('Notes', 'h2');
    addParagraph('Sleep has been averaging 7.2 hours, need to push for 8. Morning heart rate variability trending up which is a good sign of adaptation. Weight stable at 168 lbs. Increased protein to 140g/day.');
  }),

  () => createNote('API Design Best Practices', ({ addParagraph, addCode, addList, addDivider }) => {
    addParagraph('RESTful API Design Guidelines', 'h1');
    addParagraph('A comprehensive guide for designing consistent, predictable, and developer-friendly APIs. These conventions apply to all new services in our platform.');
    addParagraph('URL Structure', 'h2');
    addParagraph('Use nouns for resources, not verbs. Plural names for collections. Nest resources to show relationships, but avoid nesting deeper than two levels.');
    addCode('# Good\nGET    /api/v2/users\nGET    /api/v2/users/123\nGET    /api/v2/users/123/orders\nPOST   /api/v2/users\nPATCH  /api/v2/users/123\nDELETE /api/v2/users/123\n\n# Bad\nGET    /api/v2/getUsers\nPOST   /api/v2/createUser\nGET    /api/v2/users/123/orders/456/items/789  # too deep', 'text');
    addDivider();
    addParagraph('Error Responses', 'h2');
    addParagraph('All errors should return a consistent JSON structure with a machine-readable code and a human-readable message. Include a request ID for tracing.');
    addCode('{\n  "error": {\n    "code": "VALIDATION_FAILED",\n    "message": "Email address is invalid",\n    "details": [\n      {\n        "field": "email",\n        "constraint": "must be a valid email address",\n        "value": "not-an-email"\n      }\n    ],\n    "requestId": "req_abc123xyz"\n  }\n}', 'json');
    addParagraph('Pagination', 'h2');
    addList('Use cursor-based pagination for large datasets (not offset-based)');
    addList('Return next/prev links in response headers or body');
    addList('Default page size: 25, max: 100');
    addList('Include total count only when explicitly requested (?include=count)');
  }),

  () => createNote('Home Renovation Budget Tracker', ({ addParagraph, addList, addDivider }) => {
    addParagraph('Kitchen Renovation Budget', 'h1');
    addParagraph('Total budget: $45,000. Timeline: 8 weeks starting April 15. Contractor: Martinez & Sons Construction.');
    addParagraph('Estimates Received', 'h2');
    addList('Cabinetry (custom oak) — $12,500');
    addList('Countertops (quartz, Calacatta) — $4,800');
    addList('Appliances (Sub-Zero fridge, Wolf range, Bosch dishwasher) — $9,200');
    addList('Plumbing rough-in and fixtures — $3,600');
    addList('Electrical (20 amp circuits, under-cabinet lighting) — $2,800');
    addList('Flooring (engineered hardwood) — $3,400');
    addList('Backsplash (handmade ceramic tile) — $1,900');
    addList('Labor and demolition — $5,500');
    addList('Contingency (10%) — $4,500');
    addDivider();
    addParagraph('Decisions Needed', 'h2');
    addList('Cabinet hardware — leaning toward brass pulls from Schoolhouse Electric', 'todo', false);
    addList('Pendant lights over island — need to choose between Muuto and Tom Dixon', 'todo', false);
    addList('Faucet finish — brushed nickel vs unlacquered brass', 'todo', false);
    addList('Paint color for walls — Benjamin Moore White Dove or Simply White', 'todo', false);
    addDivider();
    addParagraph('The contractor suggested moving the gas line for the range to the island. This would add $2,200 but opens up the layout significantly. Need to discuss with the designer before committing.');
  }),

  () => createNote('Git Workflow and Branch Strategy', ({ addParagraph, addCode, addList, addDivider }) => {
    addParagraph('Git Branch Strategy', 'h1');
    addParagraph('Our team follows a trunk-based development model with short-lived feature branches. This keeps integration pain minimal and enables continuous delivery.');
    addParagraph('Branch Naming', 'h2');
    addList('Feature: feature/TICKET-123-short-description');
    addList('Bug fix: fix/TICKET-456-what-was-broken');
    addList('Hotfix: hotfix/critical-description');
    addList('Release: release/v2.4.0');
    addDivider();
    addParagraph('Commit Message Convention', 'h2');
    addCode('feat: add user profile avatar upload\nfix: prevent duplicate webhook deliveries\nrefactor: extract email validation into shared util\nperf: cache database connection pool per request\ndocs: update API authentication guide\nchore: upgrade dependencies to latest versions\ntest: add integration tests for payment flow', 'text');
    addParagraph('Pull Request Rules', 'h2');
    addList('All PRs require at least one approval from a code owner');
    addList('CI must pass (lint, typecheck, unit tests, integration tests)');
    addList('Branch must be up-to-date with main before merge');
    addList('Squash merge by default, merge commit for release branches');
    addList('Delete branch after merge');
    addParagraph('We auto-deploy to staging on merge to main. Production deploys happen daily at 10am ET unless there\'s a freeze. Hotfixes bypass the daily window and deploy immediately after approval.');
  }),

  () => createNote('Photography Composition Techniques', ({ addParagraph, addList, addDivider }) => {
    addParagraph('Composition in Photography', 'h1');
    addParagraph('Notes from the weekend workshop with Maria Gonzalez. These techniques apply to both landscape and street photography.');
    addParagraph('Rule of Thirds', 'h2');
    addParagraph('Place key elements along the grid lines or at intersection points. The eye naturally gravitates to these positions. In landscapes, put the horizon on the top or bottom third line, never in the center unless symmetry is intentional.');
    addParagraph('Leading Lines', 'h2');
    addParagraph('Use roads, rivers, fences, shadows, or architectural elements to guide the viewer\'s eye from the foreground into the frame. Diagonal lines create energy and movement. Converging lines create depth and draw attention to the vanishing point.');
    addDivider();
    addParagraph('Light and Shadow', 'h2');
    addList('Golden hour (first/last hour of sunlight) — warm, directional light');
    addList('Blue hour (just before sunrise/after sunset) — cool, even light');
    addList('Harsh midday sun — use for high contrast, dramatic shadows');
    addList('Overcast sky — natural diffuser, great for portraits');
    addList('Backlight — creates rim lighting and silhouettes');
    addDivider();
    addParagraph('Negative Space', 'h2');
    addParagraph('Empty space in a composition isn\'t wasted — it creates breathing room and emphasizes the subject. A lone figure against a vast sky conveys solitude. A small boat on an empty ocean conveys scale. The space itself becomes part of the story.');
    addParagraph('Maria\'s golden rule: "If everything is important, nothing is important. Choose one subject and let the composition serve it."');
  }),

  () => createNote('Docker Compose Development Setup', ({ addParagraph, addCode, addList }) => {
    addParagraph('Local Development Environment', 'h1');
    addParagraph('This docker-compose setup spins up all required services for local development. No need to install PostgreSQL, Redis, or Elasticsearch locally.');
    addParagraph('Quick Start', 'h2');
    addList('Clone the repo and cd into it');
    addList('Copy .env.example to .env and fill in your values');
    addList('Run: docker compose up -d');
    addList('Run: pnpm migrate && pnpm seed');
    addList('Visit http://localhost:3000');
    addCode('version: "3.9"\nservices:\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_DB: peak_dev\n      POSTGRES_USER: peak\n      POSTGRES_PASSWORD: localdev\n    ports:\n      - "5432:5432"\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n\n  redis:\n    image: redis:7-alpine\n    ports:\n      - "6379:6379"\n\n  elasticsearch:\n    image: elasticsearch:8.12.0\n    environment:\n      - discovery.type=single-node\n      - xpack.security.enabled=false\n      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"\n    ports:\n      - "9200:9200"\n    volumes:\n      - esdata:/usr/share/elasticsearch/data\n\n  mailhog:\n    image: mailhog/mailhog\n    ports:\n      - "1025:1025"\n      - "8025:8025"\n\nvolumes:\n  pgdata:\n  esdata:', 'yaml');
    addParagraph('Troubleshooting', 'h2');
    addParagraph('If Elasticsearch fails to start with a "max virtual memory areas" error, run: sudo sysctl -w vm.max_map_count=262144. For persistent fix, add it to /etc/sysctl.conf.');
  }),

  () => createNote('Mindfulness and Focus Techniques', ({ addParagraph, addList, addDivider }) => {
    addParagraph('Focus and Deep Work Strategies', 'h1');
    addParagraph('Collected techniques for maintaining focus during long coding sessions and creative work. Based on research from Cal Newport, Andrew Huberman, and personal experimentation.');
    addParagraph('Environment Design', 'h2');
    addList('Phone in another room during deep work blocks');
    addList('Use website blockers (Cold Turkey) during focus sessions');
    addList('Noise-canceling headphones with brown noise or binaural beats');
    addList('Clean desk — only laptop, water, and notebook visible');
    addList('Consistent workspace signals the brain it\'s time to focus');
    addDivider();
    addParagraph('Time Blocking', 'h2');
    addParagraph('The most effective pattern I\'ve found is 90-minute deep work blocks separated by 20-minute breaks. This aligns with the brain\'s natural ultradian rhythm. During the break, walk outside — the optic flow from forward movement actively reduces cortisol.');
    addParagraph('Morning is best for creative and analytical work. Afternoons for meetings and administrative tasks. Protect the morning block at all costs.');
    addDivider();
    addParagraph('Recovery', 'h2');
    addParagraph('Deep work depletes willpower and prefrontal cortex glucose. Recovery is not optional — it\'s part of the process. Non-sleep deep rest (NSDR) for 10-20 minutes after lunch restores cognitive capacity better than caffeine. Regular exercise, especially zone 2 cardio, improves baseline focus.');
    addList('Sleep 7-9 hours (non-negotiable)');
    addList('Morning sunlight within 30 minutes of waking');
    addList('Limit caffeine to before noon');
    addList('NSDR or meditation after lunch');
    addList('Evening walk to decompress');
  }),

  () => createNote('GraphQL Schema Design', ({ addParagraph, addCode, addDivider }) => {
    addParagraph('GraphQL API Schema', 'h1');
    addParagraph('Schema design for the new collaborative workspace product. Emphasis on real-time subscriptions and efficient data loading with DataLoader pattern.');
    addCode('type User {\n  id: ID!\n  name: String!\n  email: String!\n  avatar: String\n  workspaces: [Workspace!]!\n  createdAt: DateTime!\n}\n\ntype Workspace {\n  id: ID!\n  name: String!\n  description: String\n  owner: User!\n  members: [Member!]!\n  documents: DocumentConnection!\n  createdAt: DateTime!\n  updatedAt: DateTime!\n}\n\ntype Member {\n  user: User!\n  role: MemberRole!\n  joinedAt: DateTime!\n}\n\nenum MemberRole {\n  OWNER\n  ADMIN\n  EDITOR\n  VIEWER\n}\n\ntype Document {\n  id: ID!\n  title: String!\n  content: JSON!\n  author: User!\n  workspace: Workspace!\n  collaborators: [User!]!\n  version: Int!\n  createdAt: DateTime!\n  updatedAt: DateTime!\n}', 'graphql');
    addDivider();
    addParagraph('Subscriptions', 'h2');
    addCode('type Subscription {\n  documentUpdated(workspaceId: ID!): DocumentUpdate!\n  memberJoined(workspaceId: ID!): Member!\n  notificationReceived: Notification!\n}\n\ntype DocumentUpdate {\n  document: Document!\n  operation: UpdateOperation!\n  cursor: JSON!\n  author: User!\n}', 'graphql');
    addParagraph('We use cursor-based pagination for all connection types. The DocumentConnection follows the Relay specification with edges and pageInfo. DataLoader batches user lookups to prevent N+1 queries when resolving member lists.');
  }),

  () => createNote('Travel Itinerary — Kyoto, Japan', ({ addParagraph, addList, addDivider }) => {
    addParagraph('Kyoto Trip Plan — October 2026', 'h1');
    addParagraph('10-day trip during peak autumn foliage season. Flying into KIX (Osaka Kansai), staying in a machiya townhouse in Higashiyama district.');
    addParagraph('Day 1-2: Higashiyama', 'h2');
    addList('Walk the Philosopher\'s Path along the canal');
    addList('Nanzen-ji temple — aqueduct and zen gardens');
    addList('Kiyomizu-dera at sunset for autumn colors');
    addList('Evening stroll through Gion for traditional architecture');
    addDivider();
    addParagraph('Day 3-4: Arashiyama', 'h2');
    addList('Bamboo Grove early morning (arrive by 7am to avoid crowds)');
    addList('Tenryu-ji temple and garden');
    addList('Monkey Park Iwatayama for panoramic city views');
    addList('Boat ride on the Hozu River');
    addList('Saga-Toriimoto preserved street for lunch');
    addDivider();
    addParagraph('Day 5: Fushimi', 'h2');
    addList('Fushimi Inari shrine — full hike to the summit (2-3 hours)');
    addList('Sake brewery district — tasting at Gekkeikan');
    addParagraph('Day 6-7: Day trips', 'h2');
    addList('Nara — deer park, Todai-ji, Kasuga-taisha');
    addList('Uji — Byodo-in temple, matcha shops along the river');
    addDivider();
    addParagraph('Food Notes', 'h2');
    addParagraph('Reservations needed: Kikunoi (kaiseki, 3 months ahead), Monk (modern Japanese). Try yudofu (hot tofu) at Nanzenji Junsei. Street food at Nishiki Market. Matcha everything in Uji.');
  }),

  () => createNote('WebAssembly Performance Benchmarks', ({ addParagraph, addCode, addList, addDivider }) => {
    addParagraph('WASM vs JavaScript Performance Analysis', 'h1');
    addParagraph('Benchmarking WebAssembly against native JavaScript for compute-intensive operations in the browser. Testing image processing, physics simulation, and cryptographic operations.');
    addParagraph('Test Setup', 'h2');
    addList('Browser: Chrome 124 (V8 engine)');
    addList('WASM toolchain: Rust + wasm-pack');
    addList('Benchmark: 1000 iterations, median of 5 runs');
    addList('Input: 4K image (3840x2160), 33M pixels');
    addDivider();
    addParagraph('Image Processing Results', 'h2');
    addParagraph('Gaussian blur (5x5 kernel) over a 4K image:');
    addList('JavaScript: 847ms average');
    addList('WASM (Rust): 124ms average');
    addList('Speedup: 6.8x');
    addCode('// Rust WASM implementation\n#[wasm_bindgen]\npub fn gaussian_blur(pixels: &mut [u8], width: u32, height: u32, sigma: f32) {\n    let kernel = compute_kernel(sigma);\n    let radius = kernel.len() / 2;\n    let mut temp = vec![0u8; pixels.len()];\n    \n    // Horizontal pass\n    for y in 0..height as usize {\n        for x in 0..width as usize {\n            let mut r = 0.0f32;\n            let mut g = 0.0f32;\n            let mut b = 0.0f32;\n            for k in 0..kernel.len() {\n                let sx = (x as i32 + k as i32 - radius as i32)\n                    .max(0).min(width as i32 - 1) as usize;\n                let idx = (y * width as usize + sx) * 4;\n                r += pixels[idx] as f32 * kernel[k];\n                g += pixels[idx + 1] as f32 * kernel[k];\n                b += pixels[idx + 2] as f32 * kernel[k];\n            }\n            let idx = (y * width as usize + x) * 4;\n            temp[idx] = r as u8;\n            temp[idx + 1] = g as u8;\n            temp[idx + 2] = b as u8;\n            temp[idx + 3] = pixels[idx + 3];\n        }\n    }\n    pixels.copy_from_slice(&temp);\n}', 'rust');
    addDivider();
    addParagraph('Key Takeaways', 'h2');
    addParagraph('WASM excels at tight numerical loops and memory-intensive operations. For DOM manipulation or async I/O, JavaScript is still faster due to WASM-JS bridge overhead. The sweet spot is offloading compute kernels to WASM while keeping orchestration in JS.');
  }),

  () => createNote('Startup Financial Model', ({ addParagraph, addList, addDivider }) => {
    addParagraph('Series A Financial Projections', 'h1');
    addParagraph('Revenue model and projections for the investor deck. Based on current growth trajectory of 15% MoM with 92% gross retention and 115% net revenue retention.');
    addParagraph('Revenue Breakdown (Projected)', 'h2');
    addList('Q1 2026: $180K ARR — 45 customers, $4K average ACV');
    addList('Q2 2026: $320K ARR — 72 customers, expansion from existing');
    addList('Q3 2026: $520K ARR — 110 customers, enterprise tier launch');
    addList('Q4 2026: $840K ARR — 165 customers, channel partnerships begin');
    addList('Q1 2027: $1.2M ARR — target for Series A close');
    addDivider();
    addParagraph('Unit Economics', 'h2');
    addList('CAC (blended): $3,200');
    addList('Average ACV: $5,100');
    addList('LTV (3-year): $14,500');
    addList('LTV/CAC ratio: 4.5x');
    addList('Payback period: 7.5 months');
    addList('Gross margin: 82%');
    addDivider();
    addParagraph('Hiring Plan', 'h2');
    addParagraph('Current team: 8 (4 eng, 1 design, 1 sales, 1 marketing, 1 ops). Post Series A target: 22 people by end of 2026. Key hires: VP Engineering, 3 senior engineers, 2 AEs, 1 SDR, customer success lead, head of marketing, DevRel.');
    addParagraph('Burn rate will increase from $85K/mo to $210K/mo. With $4M raise at 20% dilution, runway extends to 19 months assuming conservative growth scenario.');
  }),

  () => createNote('CSS Grid Layout Patterns', ({ addParagraph, addCode, addDivider }) => {
    addParagraph('CSS Grid Cheat Sheet', 'h1');
    addParagraph('Common layout patterns using CSS Grid. These cover 90% of the layouts I build.');
    addParagraph('Holy Grail Layout', 'h2');
    addCode('.layout {\n  display: grid;\n  grid-template-areas:\n    "header header header"\n    "nav    main   aside"\n    "footer footer footer";\n  grid-template-columns: 200px 1fr 200px;\n  grid-template-rows: auto 1fr auto;\n  min-height: 100vh;\n}\n\n.header { grid-area: header; }\n.nav    { grid-area: nav; }\n.main   { grid-area: main; }\n.aside  { grid-area: aside; }\n.footer { grid-area: footer; }', 'css');
    addDivider();
    addParagraph('Responsive Card Grid', 'h2');
    addCode('.card-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));\n  gap: 24px;\n  padding: 24px;\n}', 'css');
    addParagraph('The auto-fill with minmax is the most useful pattern. Cards are at least 280px wide and expand to fill available space. No media queries needed — the grid handles responsiveness automatically.');
    addDivider();
    addParagraph('Centering (the easy way)', 'h2');
    addCode('.centered {\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n}', 'css');
    addParagraph('Masonry Layout (with subgrid)', 'h2');
    addCode('.masonry {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  grid-template-rows: masonry;\n  gap: 16px;\n}\n\n/* Fallback for browsers without masonry */\n@supports not (grid-template-rows: masonry) {\n  .masonry {\n    columns: 3;\n    column-gap: 16px;\n  }\n  .masonry > * {\n    break-inside: avoid;\n    margin-bottom: 16px;\n  }\n}', 'css');
  }),

  () => createNote('Cognitive Biases in Software Engineering', ({ addParagraph, addList, addDivider }) => {
    addParagraph('Cognitive Biases That Affect Engineers', 'h1');
    addParagraph('Understanding these biases helps us make better technical decisions. Every engineer should be aware of how their brain shortcuts can lead to poor choices in architecture, estimation, and debugging.');
    addParagraph('Planning Fallacy', 'h2');
    addParagraph('We consistently underestimate how long tasks will take, even when we have data from similar past tasks. The median engineering estimate is 2-3x lower than actual completion time. Mitigation: use reference class forecasting — how long did the last 5 similar tasks actually take?');
    addDivider();
    addParagraph('Sunk Cost Fallacy', 'h2');
    addParagraph('The urge to continue investing in a failing approach because of time already spent. "We\'ve spent 3 weeks on this custom solution, we can\'t switch to the library now." The 3 weeks are gone regardless — evaluate the path forward on its own merits.');
    addParagraph('Anchoring Bias', 'h2');
    addParagraph('The first number mentioned becomes the anchor. If someone says "this should take about 2 weeks," subsequent estimates cluster around 2 weeks regardless of actual complexity. Always estimate independently before sharing.');
    addDivider();
    addParagraph('Survivorship Bias', 'h2');
    addParagraph('We study successful systems and try to replicate their patterns, ignoring the many failed systems that used the same patterns. "Google uses microservices, so we should too" — ignoring that thousands of companies failed with microservices while Google succeeded for other reasons.');
    addList('Confirmation bias — seeking evidence that supports our existing beliefs');
    addList('Dunning-Kruger effect — overconfidence in unfamiliar domains');
    addList('Not-invented-here syndrome — rejecting external solutions in favor of custom builds');
    addList('Bikeshedding — spending disproportionate time on trivial decisions');
    addList('Availability heuristic — overweighting recent or dramatic events in risk assessment');
  }),

  () => createNote('Music Theory — Chord Progressions', ({ addParagraph, addList, addCode, addDivider }) => {
    addParagraph('Common Chord Progressions', 'h1');
    addParagraph('Reference sheet for songwriting and analysis. All examples in the key of C major unless noted.');
    addParagraph('The Nashville Number System', 'h2');
    addParagraph('Instead of chord names, use scale degree numbers. This makes transposition trivial and helps identify patterns across keys.');
    addCode('Key of C:  C=1  Dm=2m  Em=3m  F=4  G=5  Am=6m  Bdim=7dim\nKey of G:  G=1  Am=2m  Bm=3m  C=4  D=5  Em=6m  F#dim=7dim', 'text');
    addDivider();
    addParagraph('Pop Progressions', 'h2');
    addList('1-5-6m-4 (C-G-Am-F) — "Let It Be", "No Woman No Cry", "With or Without You"');
    addList('6m-4-1-5 (Am-F-C-G) — "Save Tonight", "Numb", axis of awesome progression');
    addList('1-4-5-4 (C-F-G-F) — classic rock and roll');
    addList('1-6m-4-5 (C-Am-F-G) — "Stand By Me", "Every Breath You Take"');
    addList('2m-5-1 (Dm-G-C) — the ii-V-I jazz turnaround');
    addDivider();
    addParagraph('Modal Interchange', 'h2');
    addParagraph('Borrowing chords from the parallel minor key adds color and emotion. The most common borrowed chord is the bVII (Bb in C major), which creates a dramatic, cinematic feel. The iv minor (Fm in C major) adds melancholy without fully modulating.');
    addParagraph('Secondary Dominants', 'h2');
    addParagraph('Any diatonic chord can be preceded by its own V chord. V/V (D major in C) resolving to G creates tension and forward motion. V/vi (E major in C) resolving to Am is the basis of countless pop and rock songs.');
  }),

  () => createNote('Incident Response Playbook', ({ addParagraph, addList, addCode, addDivider }) => {
    addParagraph('Production Incident Response Procedures', 'h1');
    addParagraph('Standard operating procedures for handling production incidents. All on-call engineers must be familiar with this playbook.');
    addParagraph('Severity Levels', 'h2');
    addList('SEV1: Complete service outage affecting all users. Response: 5 minutes.', 'numbered');
    addList('SEV2: Partial outage or severe degradation (>10% of users). Response: 15 minutes.', 'numbered');
    addList('SEV3: Minor degradation, workaround available. Response: 1 hour.', 'numbered');
    addList('SEV4: Non-urgent issue, no user impact. Response: next business day.', 'numbered');
    addDivider();
    addParagraph('First Responder Checklist', 'h2');
    addList('Acknowledge the page within SLA', 'todo', false);
    addList('Open incident channel in Slack (#inc-YYYY-MM-DD-short-desc)', 'todo', false);
    addList('Assess severity and escalate if needed', 'todo', false);
    addList('Check recent deployments: did anything ship in the last 2 hours?', 'todo', false);
    addList('Check infrastructure dashboards for obvious anomalies', 'todo', false);
    addList('If recent deploy is suspect, rollback first, investigate second', 'todo', false);
    addDivider();
    addParagraph('Useful Commands', 'h2');
    addCode('# Check recent deploys\nkubectl rollout history deployment/api-server -n production\n\n# Quick rollback\nkubectl rollout undo deployment/api-server -n production\n\n# Check pod health\nkubectl get pods -n production | grep -v Running\n\n# Tail error logs\nkubectl logs -f deployment/api-server -n production --since=5m | grep ERROR\n\n# Check node resources\nkubectl top nodes', 'bash');
    addParagraph('Post-Incident', 'h2');
    addParagraph('Write a blameless post-mortem within 48 hours. Focus on systemic improvements, not individual mistakes. Every incident is a learning opportunity. Share the post-mortem in #engineering and discuss in the next team meeting.');
  }),
];

// Generate and save all notes
const newIndex = [...existingIndex];
let created = 0;

for (const noteFn of notes) {
  const { ydoc, title, preview } = noteFn();
  const id = generateId();
  const now = Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000); // random date in last 30 days

  // Encode and write binary
  const data = Y.encodeStateAsUpdate(ydoc);
  const binPath = join(NOTES_DIR, `${id}.bin`);
  writeFileSync(binPath, Buffer.from(data));
  ydoc.destroy();

  // Add to index
  newIndex.push({
    id,
    title,
    createdAt: now,
    updatedAt: now,
    preview: preview.slice(0, 100),
    mode: 'page',
    pinned: false,
  });

  created++;
  console.log(`  ✓ ${title}`);
}

// Write index
writeFileSync(INDEX_PATH, JSON.stringify(newIndex, null, 2));

console.log(`\nDone! Created ${created} notes.`);
console.log('Restart Peak to see them.');
