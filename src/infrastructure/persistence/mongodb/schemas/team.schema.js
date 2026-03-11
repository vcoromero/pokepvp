import mongoose from 'mongoose';

const pokemonDetailSchema = new mongoose.Schema({
  pokemonId: { type: Number, required: true },
  name: { type: String, default: '' },
  sprite: { type: String, default: '' },
  type: { type: [String], default: [] },
}, { _id: false });

const teamSchema = new mongoose.Schema({
  lobbyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lobby', required: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  pokemonIds: [{ type: Number }],
  pokemonDetails: [pokemonDetailSchema],
}, { timestamps: true });

teamSchema.index({ lobbyId: 1, playerId: 1 }, { unique: true });

export const TeamModel = mongoose.models.Team ?? mongoose.model('Team', teamSchema);
