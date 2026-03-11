import { TeamModel } from '../schemas/team.schema.js';
import { throwMappedError } from '../map-repository-error.js';

function toDomain(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id?.toString(),
    lobbyId: obj.lobbyId?.toString(),
    playerId: obj.playerId?.toString(),
    pokemonIds: obj.pokemonIds ?? [],
  };
}

export class TeamMongoRepository {
  async save(team) {
    try {
      const payload = {
        lobbyId: team.lobbyId,
        playerId: team.playerId,
        pokemonIds: team.pokemonIds ?? [],
      };
      let doc;
      if (team.id) {
        doc = await TeamModel.findByIdAndUpdate(
          team.id,
          { $set: payload },
          { new: true, runValidators: true }
        );
        if (!doc) return null;
      } else {
        doc = await TeamModel.findOneAndUpdate(
          { lobbyId: team.lobbyId, playerId: team.playerId },
          { $set: payload },
          { new: true, upsert: true, runValidators: true }
        );
      }
      return toDomain(doc);
    } catch (err) {
      throwMappedError(err);
    }
  }

  async findByLobbyAndPlayer(lobbyId, playerId) {
    const doc = await TeamModel.findOne({ lobbyId, playerId });
    return toDomain(doc);
  }

  async findByLobby(lobbyId) {
    const docs = await TeamModel.find({ lobbyId }).lean();
    return docs.map((d) => toDomain({ ...d, _id: d._id }));
  }
}
