import { BattleModel } from '../schemas/battle.schema.js';
import { throwMappedError } from '../map-repository-error.js';

function toDomain(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id?.toString(),
    lobbyId: obj.lobbyId?.toString(),
    startedAt: obj.startedAt,
    winnerId: obj.winnerId?.toString() ?? undefined,
    nextToActPlayerId: obj.nextToActPlayerId?.toString() ?? undefined,
  };
}

export class BattleMongoRepository {
  async save(battle) {
    try {
      const payload = {
        lobbyId: battle.lobbyId,
        startedAt: battle.startedAt ?? new Date(),
        winnerId: battle.winnerId ?? null,
        nextToActPlayerId: battle.nextToActPlayerId ?? null,
      };
      let doc;
      if (battle.id) {
        doc = await BattleModel.findByIdAndUpdate(
          battle.id,
          { $set: payload },
          { new: true, runValidators: true }
        );
        if (!doc) return null;
      } else {
        doc = new BattleModel(payload);
        await doc.save();
      }
      return toDomain(doc);
    } catch (err) {
      throwMappedError(err);
    }
  }

  async findById(id) {
    const doc = await BattleModel.findById(id);
    return toDomain(doc);
  }

  async findByLobbyId(lobbyId) {
    const doc = await BattleModel.findOne({ lobbyId });
    return toDomain(doc);
  }
}
