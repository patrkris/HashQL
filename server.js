import dedent from './dedent.js'

export default function(queries, options, handlers) {
  arguments.length === 2 && (handlers = options, options = {})
  let get = typeof queries === 'function'
    ? queries
    : (hash, tag) => queries[tag] && queries[tag][hash]
  if (options.dedent !== false) {
    const inner = get
    get = async(hash, tag) => dedent(await inner(hash, tag))
  }

  return async function evaluate({ tag, hash, input }, context) {
    const query = await get(hash, tag)
    let finish

    if (!query)
      throw Object.assign(new Error(hash + ' not found for ' + tag), { code: 'NOT_FOUND', status: 404 })

    if (options.oneval) {
      finish = await options.oneval({ tag, hash, input }, context)
    }
    const result = Promise.resolve(
      handlers[tag](
        Object.assign(query, { raw: query }),
        await Promise.all(input.map(x =>
          x.query
            ? evaluate(x.query)
            : x.value
        )),
        context
      )
    )
    finish && finish({ tag, hash, input }, context)
    return result
  }
}
