import { problems } from '../data';
import { RecallDatabase } from '../storage/database';
import { ReviewRepository } from '../storage/reviewRepository';
import { ReviewController } from '../review/controller';
import { LibraryController } from './controller';

export const browserRepository = new ReviewRepository(new RecallDatabase(), problems);
export const browserLibrary = new LibraryController(browserRepository, problems);
export const browserReview = new ReviewController(browserRepository, problems);
