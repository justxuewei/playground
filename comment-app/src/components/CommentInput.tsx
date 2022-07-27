import React, { Component, ReactNode } from 'react';

interface IProps {
    username: string;
    onSubmit?: (username: string, content: string) => void,
    onUsernameInputBlur?: (username: string) => void;
}

interface IState {
    username: string;
    content: string;
}

class CommentInput extends Component<IProps, IState> {
    private textarea: React.RefObject<HTMLTextAreaElement>;

    constructor(props: IProps) {
        super(props);
        this.state = {
            username: props.username,
            content: '',
        };

        this.textarea = React.createRef();
    }

    componentDidMount() {
        this.textarea.current?.focus();
    }

    render(): ReactNode {
        return (
            <div className='comment-input'>
                <div className='comment-field'>
                    <span className='comment-field-name'>用户名：</span>
                    <div className='comment-field-input'>
                        <input 
                            value={this.state.username} 
                            onBlur={this.handleUsernameBlur.bind(this)}
                            onChange={this.handleUsernameChange.bind(this)} />
                    </div>
                </div>
                <div className='comment-field'>
                    <span className='comment-field-name'>评论内容：</span>
                    <div className='comment-field-input'>
                        <textarea
                            ref={this.textarea}
                            value={this.state.content} 
                            onChange={this.handleContentChange.bind(this)} />
                    </div>
                </div>
                <div className='comment-field-button'>
                    <button onClick={this.handleSubmit.bind(this)}>
                        发布
                    </button>
                </div>
            </div>
        );
    }

    // save username to local storage if input loss focus
    handleUsernameBlur(event: React.FocusEvent<HTMLInputElement>): void {
        if (this.props.onUsernameInputBlur) {
            this.props.onUsernameInputBlur(event.target.value);
        }
    }

    handleUsernameChange(event: React.ChangeEvent<HTMLInputElement>): void {
        this.setState({
            username: event.target.value
        });
    }

    handleContentChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
        this.setState({
            content: event.target.value
        });
    }

    handleSubmit() {
        if (this.props.onSubmit) {
            const { username, content } = this.state;
            if (username === '') {
                alert("username is required");
                return;
            }
            if (content === '') {
                alert("content is required");
                return;
            }
            this.props.onSubmit(username, content);
            this.setState({
                username: username,
            });
        }
    }
}

export default CommentInput;
