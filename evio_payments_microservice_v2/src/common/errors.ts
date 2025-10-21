export class DbInsertionError extends Error {
  constructor(dbName?: string, collectionName?: string, document?: any) {
    super(
      `Failed insertion in database ${dbName}, collection ${collectionName}, document ${JSON.stringify(document)}`
    )
    this.name = 'DbInsertionError'
  }
}

export class DbUpdateError extends Error {
  constructor(dbName?: string, collectionName?: string, document?: any) {
    super(
      `Failed updating document in database ${dbName}, collection ${collectionName}, document ${JSON.stringify(document)}`
    )
    this.name = 'DbUpdateError'
  }
}
