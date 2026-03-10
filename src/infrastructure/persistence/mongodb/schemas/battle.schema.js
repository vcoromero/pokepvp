import mongoose from 'mongoose';

const battleSchema = new mongoose.Schema({
  lobbyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lobby', required: true },
  startedAt: { type: Date, default: Date.now },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  nextToActPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
}, { timestamps: true });

battleSchema.index({ lobbyId: 1 }, { unique: true });

export const BattleModel = mongoose.models.Battle ?? mongoose.model('Battle', battleSchema);
