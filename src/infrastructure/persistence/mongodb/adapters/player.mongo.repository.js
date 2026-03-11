import { PlayerModel } from '../schemas/player.schema.js';
import { throwMappedError } from '../map-repository-error.js';

function toDomain(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id?.toString(),
    nickname: obj.nickname,
    lobbyId: obj.lobbyId?.toString() ?? undefined,
  };
}

export class PlayerMongoRepository {
  async save(player) {
    try {
      const payload = {
        nickname: player.nickname,
        lobbyId: player.lobbyId ?? null,
      };
      let doc;
      if (player.id) {
        doc = await PlayerModel.findByIdAndUpdate(
          player.id,
          { $set: payload },
          { new: true, runValidators: true }
        );
        if (!doc) return null;
      } else {
        doc = new PlayerModel(payload);
        await doc.save();
      }
      return toDomain(doc);
    } catch (err) {
      throwMappedError(err);
    }
  }

  async findById(id) {
    const doc = await PlayerModel.findById(id);
    return toDomain(doc);
  }

  async findByLobbyId(lobbyId) {
    const docs = await PlayerModel.find({ lobbyId }).lean();
    return docs.map((d) => toDomain({ ...d, _id: d._id }));
  }
}
