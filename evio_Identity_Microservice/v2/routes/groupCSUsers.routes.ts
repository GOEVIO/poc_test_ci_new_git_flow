import express from 'express';
import type { RequestHandler } from 'express';

import { addGroupCSUsers }  from '../controllers/addGroupCSUsers.controller'
import { getGroupCSUsers } from '../controllers/groupCSUsers.controller';
import { editGroupCSUsers } from '../controllers/editGroupCSUsers.controller'
import { deleteGroupCSUsers } from '../controllers/deleteGroupCSUsers.controller'

//USERS
import { addUserFromGroupCSUsers } from '../controllers/addUserFromGroupCSUsers.controller'
import { deleteUserFromGroupCSUsers } from '../controllers/deleteUserFromGroupCSUsers.controller'

const router = express.Router();

router.post('', addGroupCSUsers as RequestHandler);
router.get('', getGroupCSUsers as unknown as RequestHandler);
router.patch('', editGroupCSUsers as RequestHandler);
router.delete('', deleteGroupCSUsers as RequestHandler);

//USERS
router.put('', addUserFromGroupCSUsers as RequestHandler);
router.patch('', deleteUserFromGroupCSUsers as RequestHandler);

export default router;
