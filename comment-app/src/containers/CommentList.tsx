import { PureComponent, ReactNode } from "react";
import { connect } from 'react-redux';
import { Dispatch } from "redux";
import CommentList from "../components/CommentList";
import CommentModel from "../model";
import { deleteComment, initComments, State } from "../reducers/common";

export interface IProps {
    comments: CommentModel[];
    initComments: (comments: CommentModel[]) => void;
    onDeleteComment: (commentIndex: number) => void;
}

class commentListContainer extends PureComponent<IProps> {
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
        console.log("_loadComments", comments);
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

const mapDispatchToProps = (dispatch: Dispatch) => {
    return {
        // 提供给 CommentListContainer
        // 当从 LocalStorage 加载评论列表以后就会通过这个方法
        // 把评论列表初始化到 state 当中
        initComments: (comments: CommentModel[]) => {
            console.log("initComments", comments);
            dispatch(initComments(comments));
        },
        // 删除评论
        onDeleteComment: (commentIndex: number) => {
            dispatch(deleteComment(commentIndex));
        }
    };
};

export const CommentListContainer = connect(mapStateToProps, mapDispatchToProps)(commentListContainer);
