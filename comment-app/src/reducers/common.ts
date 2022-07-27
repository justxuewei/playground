import CommentModel from "../model";

const INIT_COMMENTS = 'INIT_COMMENTS';
const ADD_COMMENT = 'ADD_COMMENT';
const DELETE_COMMENT = 'DELETE_COMMENT';

export interface Action {
    type: string;
    comments?: CommentModel[];
    comment?: CommentModel;
    commentIndex?: number;
}

export type State = {
    comments: CommentModel[];
}

export const initComments = (comments: CommentModel[]): Action => {
    return {
        type: INIT_COMMENTS,
        comments: comments,
    };
};
export const addComment = (comment: CommentModel): Action => {
    return {
        type: ADD_COMMENT,
        comment: comment,
    };
};
export const deleteComment = (commentIndex: number): Action => {
    return {
        type: DELETE_COMMENT,
        commentIndex: commentIndex
    };
};

export const Reducer = (state: State, action: Action): State => {
    switch (action.type) {
        case INIT_COMMENTS:
            if (action.comments) {
                state.comments = action.comments;
            }
            break;
        case ADD_COMMENT:
            if (action.comment) {
                state.comments = [...state.comments, action.comment];
            }
            break;
        case DELETE_COMMENT:
            if (action.commentIndex) {
                state.comments = [
                    ...state.comments.slice(0, action.commentIndex),
                    ...state.comments.slice(action.commentIndex + 1)
                ];
            }
            break;
    }
    return state;
};
