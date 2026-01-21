import { useState, useMemo } from 'react'

// All possible trinucleotide contexts for TSV output
const BASES = ['A', 'C', 'G', 'T']

function generateAllContexts() {
  const contexts = []
  for (const before of BASES) {
    for (const ref of BASES) {
      for (const alt of BASES) {
        if (ref !== alt) {
          for (const after of BASES) {
            contexts.push(`${before}[${ref}>${alt}]${after}`)
          }
        }
      }
    }
  }
  return contexts
}

const ALL_CONTEXTS = generateAllContexts()

function parseFasta(text) {
  const lines = text.trim().split('\n')
  let sequence = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('>')) {
      sequence += trimmed.toUpperCase()
    }
  }

  return sequence
}

function parseMutation(mutStr) {
  const trimmed = mutStr.trim().toUpperCase()
  const match = trimmed.match(/^([ACGT])(\d+)([ACGT])$/)
  if (!match) return null

  return {
    ref: match[1],
    position: parseInt(match[2], 10),
    alt: match[3]
  }
}

function contextualiseMutation(sequence, mutation) {
  const { ref, position, alt } = mutation
  const idx = position - 1 // Convert 1-indexed to 0-indexed

  if (idx < 0 || idx >= sequence.length) {
    return { error: `Position ${position} out of range (sequence length: ${sequence.length})` }
  }

  const actualBase = sequence[idx]
  if (actualBase !== ref) {
    return { error: `Reference mismatch at position ${position}: expected ${ref}, found ${actualBase}` }
  }

  const before = idx > 0 ? sequence[idx - 1] : 'N'
  const after = idx < sequence.length - 1 ? sequence[idx + 1] : 'N'

  return {
    context: `${before}[${ref}>${alt}]${after}`,
    before,
    ref,
    alt,
    after,
    position
  }
}

function App() {
  const [fastaInput, setFastaInput] = useState('')
  const [mutationsInput, setMutationsInput] = useState('')

  const results = useMemo(() => {
    const sequence = parseFasta(fastaInput)
    if (!sequence) return { contextualised: [], counts: {} }

    const mutationStrings = mutationsInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    const contextualised = []
    const counts = {}

    // Initialize all counts to 0
    for (const ctx of ALL_CONTEXTS) {
      counts[ctx] = 0
    }

    for (const mutStr of mutationStrings) {
      const mutation = parseMutation(mutStr)
      if (!mutation) {
        contextualised.push({ original: mutStr, error: 'Invalid mutation format' })
        continue
      }

      const result = contextualiseMutation(sequence, mutation)
      if (result.error) {
        contextualised.push({ original: mutStr, error: result.error })
      } else {
        contextualised.push({ original: mutStr, ...result })
        if (counts.hasOwnProperty(result.context)) {
          counts[result.context]++
        }
      }
    }

    return { contextualised, counts, sequence }
  }, [fastaInput, mutationsInput])

  const tsvOutput = useMemo(() => {
    const lines = ['Context\tCount']
    for (const ctx of ALL_CONTEXTS) {
      lines.push(`${ctx}\t${results.counts[ctx] || 0}`)
    }
    return lines.join('\n')
  }, [results.counts])

  return (
    <div className="container">
      <h1>Mutation contextualiser</h1>

      <div className="input-section">
        <div className="input-group">
          <label htmlFor="fasta">FASTA sequence (header optional):</label>
          <textarea
            id="fasta"
            value={fastaInput}
            onChange={(e) => setFastaInput(e.target.value)}
            placeholder={`>sequence_name\nACGTACGTACGT...\n\nor just:\n\nACGTACGTACGT...`}
            rows={8}
          />
          {results.sequence && (
            <div className="sequence-info">
              Parsed sequence length: {results.sequence.length} bp
            </div>
          )}
        </div>

        <div className="input-group">
          <label htmlFor="mutations">Mutations (comma-separated, e.g., G123C, A456T):</label>
          <textarea
            id="mutations"
            value={mutationsInput}
            onChange={(e) => setMutationsInput(e.target.value)}
            placeholder="G123C, A456T, C789G"
            rows={4}
          />
        </div>
      </div>

      {results.contextualised.length > 0 && (
        <div className="output-section">
          <h2>Contextualised mutations</h2>
          <div className="results-list">
            {results.contextualised.map((result, idx) => (
              <div key={idx} className={`result-item ${result.error ? 'error' : ''}`}>
                <span className="original">{result.original}</span>
                <span className="arrow">&rarr;</span>
                {result.error ? (
                  <span className="error-message">{result.error}</span>
                ) : (
                  <span className="context">{result.context}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results.contextualised.length > 0 && (
        <div className="output-section">
          <h2>TSV counts (all 192 trinucleotide contexts)</h2>
          <textarea
            className="tsv-output"
            value={tsvOutput}
            readOnly
            rows={15}
          />
          <button
            className="copy-button"
            onClick={() => navigator.clipboard.writeText(tsvOutput)}
          >
            Copy TSV
          </button>
        </div>
      )}
    </div>
  )
}

export default App
