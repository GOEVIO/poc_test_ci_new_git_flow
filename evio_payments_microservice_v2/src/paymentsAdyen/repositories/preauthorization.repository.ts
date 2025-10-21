import { ConfigService } from '@nestjs/config'
import dbConnection from 'evio-library-connections'
import { DbInsertionError, DbUpdateError } from '../../common/errors'
import { Injectable } from '@nestjs/common'
import { ObjectId } from 'mongodb'

@Injectable()
export class PreAuthorizationRepository {
  private readonly dbName: string
  private readonly collectionPreAuthorization: string

  constructor(private readonly configService: ConfigService) {
    this.dbName = configService.get('db.payments.dbName') as string // validated in config file
    this.collectionPreAuthorization = configService.get('db.payments.collectionPreAuthorization') as string
  }

  /**
   * Asynchronously inserts data into the database.
   *
   * @param {any} data - The data to be inserted.
   * @return {Promise<string>} A promise that resolves to the ID of the inserted data.
   */
  async insert(data: any): Promise<string> {
    try {
      const db = await dbConnection.connect(this.dbName)
      // insert that will be sent to the database
      const result = await dbConnection.insertDocument(db.db, this.collectionPreAuthorization, data)
      // close the database connection
      await dbConnection.close(this.dbName, db)

      if (!result.acknowledged) {
        throw new DbInsertionError(this.dbName, this.collectionPreAuthorization, data)
      }

      return result.insertedId.toString()
    } catch (error) {
      console.log('Error inserting to database', error)
      throw error
    }
  }

  /**
   * Asynchronously updates a document in the database with the given data.
   *
   * @param {any} data - The data to be updated, including the userId and data fields.
   * @return {Promise<boolean>} A promise that resolves to true if the update is successful,
   *                            or throws an error if the update fails.
   */
  async update(data: any, userId?: string, sessionIdInternal?: string, id?: string): Promise<boolean> {
    try {
      // query that will be sent to the database
      const query = id
        ? { _id: new ObjectId(id) }
        : userId
          ? { userId, active: true }
          : sessionIdInternal
            ? { sessionIdInternal, active: true }
            : null
      if (!query) return false

      // update that will be sent to the database
      const update = { $set: data?.data ?? data }

      const db = await dbConnection.connect(this.dbName)
      // execute the query
      const result = await dbConnection.updateDocument(db.db, this.collectionPreAuthorization, query, update)

      // close the database connection
      await dbConnection.close(this.dbName, db)

      if (!result.acknowledged) {
        throw new DbUpdateError(this.dbName, this.collectionPreAuthorization, data)
      }

      return true
    } catch (error) {
      console.log('Error inserting to database', error)
      throw error
    }
  }

  async updateByReferenceId(query: any, updateFields: any): Promise<boolean> {
    try {
      const db = await dbConnection.connect(this.dbName)
      // execute the query
      const result = await dbConnection.updateDocument(db.db, this.collectionPreAuthorization, query, { $set: updateFields })
      // close the database connection
      await dbConnection.close(this.dbName, db)
      if (!result.acknowledged) {
        throw new DbUpdateError(this.dbName, this.collectionPreAuthorization)
      }
      return true
    } catch (error) {
      console.log('Error updating in database', error)
      throw error
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      // query that will be sent to the database
      const query = { _id: new ObjectId(id) }
      if (!query) return false

      const db = await dbConnection.connect(this.dbName)
      // execute the query
      const result = await dbConnection.deleteDocument(db.db, this.collectionPreAuthorization, query)

      // close the database connection
      await dbConnection.close(this.dbName, db)

      if (!result.acknowledged) {
        throw new DbUpdateError(this.dbName, this.collectionPreAuthorization)
      }

      return true
    } catch (error) {
      console.log('Error inserting to database', error)
      throw error
    }
  }

  async findOne(query: any): Promise<any> {
    try {
      const db = await dbConnection.connect(this.dbName)
      const result = await dbConnection.findOneDocument(db.db, this.collectionPreAuthorization, query)
      await dbConnection.close(this.dbName, db)
      return result
    } catch (error) {
      console.log('Error finding document in database', error)
      throw error
    }
  }

  async findNextToExpire(): Promise<any> {
    try {
      const db = await dbConnection.connect(this.dbName)
      const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      console.log(`Finding preauthorisations next to expire in ${oneDayFromNow.toISOString()}`)
      const result = await dbConnection.findDocuments(
        db.db,
        this.collectionPreAuthorization,
        {
          expireDate: { $lte: oneDayFromNow },
          active: true,
        },
        { adyenReference: 1, transactionId: 1, amount: 1, expireDate: 1, blobPreAuthorization: 1 }
      )
      await dbConnection.close(this.dbName, db)
      return result
    } catch (error) {
      console.log('Error finding document in database', error)
      throw error
    }
  }
}
