import { TeamModel } from '../schemas/team.schema.js';
import { throwMappedError } from '../map-repository-error.js';

function toDetail(d) {
  if (!d) return null;
  return {
    pokemonId: d.pokemonId,
    name: d.name ?? '',
    sprite: d.sprite ?? '',
    type: Array.isArray(d.type) ? d.type : [],
  };
}

function toDomain(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  const details = (obj.pokemonDetails ?? []).map(toDetail).filter(Boolean);
  return {
    id: obj._id?.toString(),
    lobbyId: obj.lobbyId?.toString(),
    playerId: obj.playerId?.toString(),
    pokemonIds: obj.pokemonIds ?? [],
    pokemonDetails: details,
  };
}

export class TeamMongoRepository {
  async save(team) {
    try {
      const pokemonDetails = (team.pokemonDetails ?? []).map((d) => ({
        pokemonId: d.pokemonId,
        name: d.name ?? '',
        sprite: d.sprite ?? '',
        type: Array.isArray(d.type) ? d.type : [],
      }));
      const payload = {
        lobbyId: team.lobbyId,
        playerId: team.playerId,
        pokemonIds: team.pokemonIds ?? [],
        pokemonDetails,
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
