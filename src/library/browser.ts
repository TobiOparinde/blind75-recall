import { problems } from '../data';
import { RecallDatabase } from '../storage/database';
import { LibraryRepository } from '../storage/libraryRepository';
import { LibraryController } from './controller';

export const browserLibrary = new LibraryController(new LibraryRepository(new RecallDatabase(), problems), problems);
