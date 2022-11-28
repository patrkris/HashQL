import crypto from 'crypto'
import recast from 'recast'
import astTypes from 'ast-types'
import fs from 'fs/promises'
import { parse } from 'acorn'
import normalize from './dedent.js'

export default function({ dedent = true, algorithm = 'md5', tags, filter = /\.js/, output }) {
  return {
    name: 'hashql',
    setup(build) {
      const queries = {}
          , matchRegex = new RegExp('(' + [].concat(tags).join('|') + ')`')

      build.onLoad({ filter }, async(args) => {
        const code = await fs.readFile(args.path, 'utf-8')
        if (!code.match(matchRegex)) {
          return {
            contents: code
          }
        }

        const ast = recast.parse(code, {
          parser: {
            parse(source, opts) {
              return parse(source, {
                ...opts,
                ecmaVersion: 2022,
                sourceType: 'module'
              })
            }
          },
          sourceFileName: args.path
        })

        astTypes.visit(ast, {
          visitTaggedTemplateExpression(path) {
            const n = path.node
                , loc = n.loc

            if (!tags.includes(n.tag.name)) return this.traverse(path)

            n.type = 'CallExpression'
            n.arguments = [
              {
                type: 'Literal',
                value: add(
                  n.tag.name,
                  n.quasi.quasis.map((x) => x.value.cooked),
                  args.path,
                  loc.start,
                  loc.end
                )
              },
              ...n.quasi.expressions
            ]
            n.callee = n.tag
            this.traverse(path)
          }
        })

        output(queries)

        return {
          contents: recast.print(ast, { sourceMapName: 'map.json' }).code
        }
      })

      function add(tag, query, file, start, end) {
        const hash = crypto.createHash(algorithm)
        const dedented = dedent ? normalize(query) : query
        dedented.forEach(x => hash.update(x))
        const checksum = hash.digest('hex')
        tag in queries === false && (queries[tag] = {})
        queries[tag][checksum] = { query, file, start, end }
        return checksum
      }
    }
  }
}
