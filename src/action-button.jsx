import React from 'react'

export function ActionButton({ primary = false, children, ...props }) {
  return <button type="button" className={primary ? 'actionButton primary' : 'actionButton'} {...props}>{children}</button>
}
