import { Component, ReactNode } from "react";
import { connect } from 'react-redux';
import CommentList from "../components/CommentList";
import CommentModel from "../model";
import { Action, deleteComment, initComments, State } from "../reducers/common";

export interface IProps {
    comments: CommentModel[];
    initComments: (comments: CommentModel[]) => Action;
    onDeleteComment: (commentIndex: number) => void;
}

export interface IState {
    comments: CommentModel[];
}

class CommentListContainer extends Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
    }

    componentWillMount() {
        this._loadComments();
    }

    _loadComments() {
        // 从 LocalStorage 中加载评论
        const commentsJson = localStorage.getItem('comments');
        const comments: CommentModel[] = commentsJson ? JSON.parse(commentsJson) : [];
        // this.props.initComments 是 connect 传进来的
        // 可以帮我们把数据初始化到 state 里面去
        this.props.initComments(comments);
    }

    handleDeleteComment(index: number) {
        const { comments } = this.props;
        const newComments = [
            ...comments.slice(0, index),
            ...comments.slice(index + 1)
        ];
        localStorage.setItem('comments', JSON.stringify(newComments));
        if (this.props.onDeleteComment) {
            // this.props.onDeleteComment 是 connect 传进来的
            // 会 dispatch 一个 action 去删除评论
            this.props.onDeleteComment(index);
        }
    }

    render(): ReactNode {
        return (
            <CommentList
                comments={this.props.comments}
                onDeleteComment={this.handleDeleteComment.bind(this)} />
        );
    }
}

// 评论列表从 state.comments 中获取
const mapStateToProps = (state: State) => {
    return {
        comments: state.comments
    };
};

const mapDispatchToProps = (dispatch: (a: Action) => void) => {
    return {
        // 提供给 CommentListContainer
        // 当从 LocalStorage 加载评论列表以后就会通过这个方法
        // 把评论列表初始化到 state 当中
        initComments: (comments: CommentModel[]) => {
            dispatch(initComments(comments));
        },
        // 删除评论
        onDeleteComment: (commentIndex: number) => {
            dispatch(deleteComment(commentIndex));
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(CommentListContainer);
