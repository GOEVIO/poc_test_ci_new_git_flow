import { ConfigService } from '@nestjs/config'
import dbConnection from 'evio-library-connections'
import { DbInsertionError, DbUpdateError } from "../../common/errors"
import { Injectable } from '@nestjs/common'


@Injectable()
export class TransactionsRepository {
    private readonly dbName: string
    private readonly collectionTransactions: string

    constructor(private readonly configService: ConfigService) {
        this.dbName = configService.get('db.payments.dbName') as string // validated in config file
        this.collectionTransactions = configService.get('db.payments.collectionTransactions') as string 
    }


    /**
     * Asynchronously inserts data into the database.
     *
     * @param {any} data - The data to be inserted.
     * @return {Promise<string>} A promise that resolves to the ID of the inserted data.
     */
    async insert(data: any): Promise<string> {
        try {
          const db = await dbConnection.connect(this.dbName);
          // insert that will be sent to the database
          const result = await dbConnection.insertDocument(
            db.db,
            this.collectionTransactions,
            data
          );
          // close the database connection
          await dbConnection.close(this.dbName, db)
    
          if (!result.acknowledged) {
            throw new DbInsertionError(
              this.dbName,
              this.collectionTransactions,
              data
            )
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
    async update(data: any, userId?: string, sessionIdInternal?: string, paymentId?: string): Promise<boolean> {
      try {
        // query that will be sent to the database
        const query = (() => {
          if (userId) return { userId, active: true };
          if (sessionIdInternal) return { sessionIdInternal };
          if (paymentId) return { paymentId };
          return null;
        })();
        if(!query){
          console.error(`Error updating TransactionsRepository database: query is null-->  userId: ${userId}  sessionIdInternal ${sessionIdInternal} paymentId ${paymentId}`);
          console.error(`Error updating TransactionsRepository database: data-->  ${JSON.stringify(data)}`);
          return false;
        } 

        // update that will be sent to the database
        const update = { $set: data.data };
       /* console.log(`TransactionsRepository: query: ${JSON.stringify(query)}`);
        console.log(`TransactionsRepository update: ${JSON.stringify(update)}`);*/
        const db = await dbConnection.connect(this.dbName);
        // execute the query
        const result = await dbConnection.updateDocument(
          db.db,
          this.collectionTransactions,
          query,
          update
        );
        // close the database connection
        await dbConnection.close(this.dbName, db)
  
        if (!result.acknowledged) {
          throw new DbUpdateError(
            this.dbName,
            this.collectionTransactions,
            data
          )
        }

        return true;
      } catch (error) {
        console.log('Error inserting to database', error)
        throw error
      }
    }

    
}