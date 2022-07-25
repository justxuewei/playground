import { Component, ReactNode } from 'react';
import CommentModel from './model';
import Comment from './Comment';

interface IProps {
    comments: Array<CommentModel>
}

class CommentList extends Component<IProps, unknown> {
    render(): ReactNode {
        return (
            <div>
                {this.props.comments.map((comment: CommentModel, i: number) =>
                    <Comment comment={comment} key={i} />
                )}
            </div>
        );
    }
}

export default CommentList;
