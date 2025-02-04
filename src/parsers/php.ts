// @ts-nocheck
import type PHP from 'php-parser'
import { Engine } from 'php-parser'
import { Parser } from './base'


/**
 * Parse a PHP expression to JavaScript.
 * Forked from: https://github.com/rmariuzzo/php-array-parser/blob/master/index.js
 */
function parseValue(expr): any {
  if (expr.kind === 'string') return expr.value
  if (expr.kind === 'number') return parseInt(expr.value, 10)
  if (expr.kind === 'boolean') return expr.value

  if (expr.kind === 'entry') {
    if (!expr.key) return parseValue(expr.value)
    return { [parseKey(expr.key)]: parseValue(expr.value) }
  }

  if (expr.kind === 'array') {
    if (expr.items.length === 0) return []

    const isKeyed = expr.items.every(item => item.key !== null)
    const items = expr.items.map(parseValue)

    if (!isKeyed) return items
    return items.reduce((acc, val) => Object.assign({}, acc, val), {})
  }

  // new supports
  if (expr.kind === 'bin' && expr.type === '.')
    return parseValue(expr.left) + parseValue(expr.right)

  if (expr.kind === 'call') {
    if (expr.arguments.length === 0) return '「」'

    const params = expr.arguments.map(parseValue).join(', ')
    if (['_', '__'].includes(expr.what.name)) return `「${params}」`
    return `「${expr.what.name}(${params})」`
  }

  throw new Error(`Unexpected PHP value: "${expr.kind}", details: ${JSON.stringify(expr)}`)
}

/**
 * Parse a PHP expression to JavaScript
 * Forked from: https://github.com/rmariuzzo/php-array-parser/blob/master/index.js
 */
function parseKey(expr): any {
  if (expr.kind === 'string') return expr.value
  if (expr.kind === 'number') return parseInt(expr.value, 10)
  if (expr.kind === 'boolean') return expr.value ? 1 : 0;
  throw new Error(`Unexpected PHP key: "${expr.kind}", details: ${JSON.stringify(expr)}`)
}

export class PhpParser extends Parser {
  id = 'php'
  readonly = true

  #engine = new Engine({
    parser: { extractDoc: true },
    ast: { withPositions: false },
  })

  constructor() {
    super(['php'], 'php')
  }

  async dump() {
    return ''
  }

  async parse(text: string) {
    // Remove left part of return expression and any ending `?>`.
    const ret = text.indexOf('return') + 'return'.length
    text = text.substr(ret)
    text = text.replace(/\?>\s*$/, '_')

    const ast = this.#engine.parseEval(text)
    for (const child of ast.children) {
      if (child.kind === 'array') return parseValue(child)
      if (child.kind !== 'expressionstatement') return {}
      if (child.expression.kind !== 'array') return {}
      return parseValue(child.expression)
    }

    return {}
  }
}
