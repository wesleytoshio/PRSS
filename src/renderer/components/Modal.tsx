import React, { Component } from 'react';

class Modal extends Component {
  state = {
    title: null,
    message: null,
    show: false,
    buttons: [],
    showCancel: true,
    mode: null,
    onCancel: () => {}
  };

  initialState = { ...this.state };

  confirm = ({ title, buttons = [], showCancel = false, onCancel = () => {} }) => {
    this.setState({
      mode: 'confirm',
      show: true,
      title,
      buttons,
      showCancel,
      onCancel
    });
  };

  alert = (message, title?) => {
    this.setState({
      mode: 'alert',
      show: true,
      message,
      title
    });
  };

  close = () => {
    this.setState(this.initialState);
  };

  getLayout = () => {
    let { title, buttons, showCancel, mode, message } = this.state;

    if (mode === 'confirm') {
      return (
        <div
          style={{
            position: 'fixed',
            backgroundColor: 'rgba(0,0,0,0.8)',
            height: '100%',
            width: '101%',
            alignItems: 'center',
            justifyContent: 'center',
            top: 0,
            left: 0,
            display: 'flex',
            zIndex: 51
          }}
        >
          <div
            style={{
              width: '100%',
              minWidth: 250,
              maxWidth: 300,
              overflow: 'hidden'
            }}
          >
            {title && (
              <div
                style={{
                  paddingBottom: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  display: 'flex'
                }}
              >
                <span
                  style={{
                    color: 'white',
                    fontSize: 22,
                    fontWeight: 300
                  }}
                >
                  {title}
                </span>
              </div>
            )}

            <div
              style={{
                backgroundColor: 'white',
                borderRadius: 20
              }}
            >
              {!!buttons.length &&
                buttons.map((button, index) => {
                  let { label, action = () => {} } = button;

                  return (
                    <div
                      key={`stdmodalbtn-${index}`}
                      onClick={() => action()}
                      style={{
                        padding: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(0,0,0,0.1)',
                        display: 'flex',
                        cursor: 'pointer'
                      }}
                    >
                      <span
                        style={{
                          fontSize: 18
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}

              {showCancel && (
                <div
                  onClick={() => {
                    this.close();
                    this.state.onCancel();
                  }}
                  style={{
                    padding: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(0,0,0,0.1)',
                    display: 'flex',
                    cursor: 'pointer'
                  }}
                >
                  <span
                    style={{
                      fontSize: 18
                    }}
                  >
                    Cancel
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    } else if (mode === 'alert') {
      return (
        <div
          style={{
            position: 'fixed',
            backgroundColor: 'rgba(0,0,0,0.8)',
            height: '100%',
            width: '101%',
            alignItems: 'center',
            justifyContent: 'center',
            top: 0,
            left: 0,
            display: 'flex',
            zIndex: 51
          }}
        >
          <div
            style={{
              width: '100%',
              minWidth: 300,
              maxWidth: 320,
              overflow: 'hidden'
            }}
          >
            {title && (
              <div
                style={{
                  paddingBottom: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  display: 'flex'
                }}
              >
                <span
                  style={{
                    color: 'white',
                    fontSize: 22,
                    fontWeight: 300
                  }}
                >
                  {title}
                </span>
              </div>
            )}

            <div
              style={{
                backgroundColor: 'white',
                borderRadius: 20
              }}
            >
              {message && (
                <div
                  style={{
                    padding: 20,
                    // minHeight: 100,
                    alignItems: 'center',
                    justifyContent: 'center',
                    display: 'flex'
                  }}
                >
                  <span
                    style={{
                      fontSize: 18
                    }}
                  >
                    {message}
                  </span>
                </div>
              )}

              <div
                onClick={() => this.close()}
                style={{
                  padding: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(0,0,0,0.1)',
                  display: 'flex',
                  cursor: 'pointer'
                }}
              >
                <span
                  style={{
                    fontSize: 18
                  }}
                >
                  OK
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
        return <div />
    }
  };

  render() {
    let { show, mode } = this.state;
    return show && mode && this.getLayout();
  }
}

let modal: Modal;
const StandardModal = () => <Modal ref={(r) => modal = r} />;
export { StandardModal, modal };