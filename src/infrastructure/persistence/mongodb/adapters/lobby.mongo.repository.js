import { LobbyModel } from '../schemas/lobby.schema.js';
import { throwMappedError } from '../map-repository-error.js';

function toDomain(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id?.toString(),
    status: obj.status,
    playerIds: (obj.playerIds || []).map((id) => (id?.toString ? id.toString() : id)),
    readyPlayerIds: (obj.readyPlayerIds || []).map((id) => (id?.toString ? id.toString() : id)),
    createdAt: obj.createdAt,
  };
}

export class LobbyMongoRepository {
  async save(lobby) {
    try {
      const payload = {
        status: lobby.status,
        playerIds: lobby.playerIds ?? [],
        readyPlayerIds: lobby.readyPlayerIds ?? [],
        ...(lobby.createdAt && { createdAt: lobby.createdAt }),
      };
      let doc;
      if (lobby.id) {
        doc = await LobbyModel.findByIdAndUpdate(
          lobby.id,
          { $set: payload },
          { new: true, runValidators: true }
        );
        if (!doc) return null;
      } else {
        doc = new LobbyModel(payload);
        await doc.save();
      }
      return toDomain(doc);
    } catch (err) {
      throwMappedError(err);
    }
  }

  async findById(id) {
    const doc = await LobbyModel.findById(id);
    return toDomain(doc);
  }

  async findActive() {
    const doc = await LobbyModel.findOne({ status: { $ne: 'finished' } }).sort({ createdAt: -1 });
    return toDomain(doc);
  }
}
