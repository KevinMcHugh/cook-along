// A small JSON Schema validator covering exactly the keywords
// schema/recipe.schema.json uses. It walks the schema file itself, so the
// schema stays the single source of truth; using a keyword not handled here
// throws rather than being silently ignored.

const HANDLED = new Set([
  "$schema", "$id", "$defs", "$ref", "title", "description", "default",
  "type", "required", "properties", "additionalProperties", "items",
  "minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum", "enum",
]);

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number" && Number.isInteger(v)) return "integer";
  return typeof v;
}

function typeMatches(want, v) {
  const got = typeOf(v);
  return want === got || (want === "number" && got === "integer");
}

function resolve(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`unsupported $ref: ${ref}`);
  return ref.slice(2).split("/").reduce((node, key) => {
    if (node == null || !(key in node)) throw new Error(`unresolvable $ref: ${ref}`);
    return node[key];
  }, root);
}

/** Returns a list of "path: message" strings; empty means valid. */
export function validate(schema, value) {
  const errors = [];
  walk(schema, schema, value, "$", errors);
  return errors;
}

function walk(root, s, v, path, errors) {
  for (const k of Object.keys(s)) {
    if (!HANDLED.has(k)) throw new Error(`validator does not handle keyword "${k}"`);
  }
  if (s.$ref) return walk(root, resolve(root, s.$ref), v, path, errors);

  if (s.type && !typeMatches(s.type, v)) {
    errors.push(`${path}: expected ${s.type}, got ${typeOf(v)}`);
    return;
  }
  if (s.enum && !s.enum.includes(v)) {
    errors.push(`${path}: must be one of ${s.enum.map((e) => JSON.stringify(e)).join(", ")}`);
  }
  if (typeof v === "string") {
    const len = [...v].length;
    if (s.minLength != null && len < s.minLength) errors.push(`${path}: shorter than ${s.minLength}`);
    if (s.maxLength != null && len > s.maxLength) errors.push(`${path}: longer than ${s.maxLength}`);
  }
  if (typeof v === "number") {
    if (s.minimum != null && v < s.minimum) errors.push(`${path}: below ${s.minimum}`);
    if (s.maximum != null && v > s.maximum) errors.push(`${path}: above ${s.maximum}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems != null && v.length < s.minItems) errors.push(`${path}: needs at least ${s.minItems} item(s)`);
    if (s.maxItems != null && v.length > s.maxItems) errors.push(`${path}: at most ${s.maxItems} item(s)`);
    if (s.items) v.forEach((item, i) => walk(root, s.items, item, `${path}[${i}]`, errors));
  }
  if (typeOf(v) === "object") {
    for (const key of s.required || []) {
      if (!(key in v)) errors.push(`${path}: missing "${key}"`);
    }
    const props = s.properties || {};
    for (const [key, child] of Object.entries(v)) {
      if (key in props) walk(root, props[key], child, `${path}.${key}`, errors);
      else if (s.additionalProperties === false) errors.push(`${path}: unexpected property "${key}"`);
    }
  }
}
