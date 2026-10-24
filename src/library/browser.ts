import { problems } from '../data';
import { RecallDatabase } from '../storage/database';
import { ManagementRepository } from '../storage/managementRepository';
import { ManagementController } from '../management/controller';
import { ReviewController } from '../review/controller';
import { LibraryController } from './controller';

export const browserRepository = new ManagementRepository(new RecallDatabase(), problems);
export const browserManagement = new ManagementController(browserRepository, new Set(problems.map((problem) => problem.id)));
export const browserLibrary = new LibraryController(browserRepository, problems);
export const browserReview = new ReviewController(browserRepository, problems);
