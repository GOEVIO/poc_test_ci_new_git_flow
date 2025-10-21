import { Types } from 'mongoose';
import { IHistory, findOneHistory, upsertOneHistory, plainToInstance, deleteInvalidFields } from "evio-library-statistics";

function _buildQuery(id: string) {
  const isObjectId = Types.ObjectId.isValid(id);

  const query: { $or: object[] } = {
    $or: [],
  };

  if (isObjectId) {
    query.$or.push({ _id: new Types.ObjectId(id) });
  }

  query.$or.push({ sessionId: id });

  if (query.$or.length === 1) {
    return query.$or[0];
  }

  return query;
}

export async function findOneHistoryById(id: string) {
  const query = _buildQuery(id);
  try {
    const data = await findOneHistory(query)
    return data;
  } catch (e) {
    console.log("not found history by id", id, e);
    throw {
      message: "[Update HistoryV2 Worker] Failed to find HistoryV2",
      cause: e,
    };
  }
}

export async function upsertOneHistoryById(id: string, history: IHistory, isNew: boolean) {
  try {
    const historyFormatted = deleteInvalidFields<Partial<IHistory>>(plainToInstance<Partial<IHistory>>(IHistory, history));
    
    delete historyFormatted?._id;

    if(historyFormatted.invoice && !historyFormatted.invoice.documentNumber) {
      historyFormatted.invoice.documentNumber = ""
    }

    if(!historyFormatted?.evId) { 
      historyFormatted.evId = "-1"
    }

    const now = new Date();
    if (isNew) {
      historyFormatted.createdAt = now;
      historyFormatted.updatedAt = now;
    } else {
      historyFormatted.updatedAt = now;
    }

    const update = isNew
      ? { $set: { ...historyFormatted, _id: new Types.ObjectId(id) } }
      : { $set: historyFormatted };

    const result = await upsertOneHistory({_id: new Types.ObjectId(id)}, update);
    
    if (!result) {
      throw new Error('Nothing saved to db')
    }
    return result
  } catch (e) {
    console.error("[Update HistoryV2 Worker] Failed to save HistoryV2", e);
    throw {
      message: "[Update HistoryV2 Worker] Failed to save HistoryV2",
      cause: e,
    };
  }
}
