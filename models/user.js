import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: { type: String },
  balance: { type: Number, default: 0 },
  totalBets: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'users', // Esto asegura que use tu colección existente
  timestamps: true 
});

export default mongoose.models.User || mongoose.model('User', UserSchema);